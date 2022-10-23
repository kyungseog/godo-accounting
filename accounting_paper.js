const {google} = require('googleapis');
const excel = require('exceljs');
const mysql = require('mysql');

const keys = require('./apikey.json');
const sql = require('./accounting_sql');
require('dotenv').config();

const paidCheckYear = 2022;
const paidCheckMonth = 10;
const spreadsheetId = process.env.SPREADSHEET_ID;

const client = new google.auth.JWT(
  keys.client_email,
  null, 
  keys.private_key, 
  ['https://www.googleapis.com/auth/spreadsheets']
);

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
});

client.authorize(function(err, tokens){
    if(err){
        console.log(err);
        return;
    }else{
        console.log('GoogleSheet Connected!');
        gsRead(client);
    }
});

//구글시트(CMI_Support_2022 위탁정산)의 해당월 시트에서 데이터 불러오기
async function gsRead(client) {
  const gsapi = google.sheets({version : 'v4', auth : client});
  const readOption = {
      spreadsheetId: spreadsheetId,
      range: paidCheckYear + '-' + paidCheckMonth + '!A5:U283' //해당월의 데이터 범위(정산업체수가 300개를 넘어갈 경우 더 늘려야함)
  };
  let data = await gsapi.spreadsheets.values.get(readOption);
  let scmNoArray = data.data.values.map( r => [r[0], r[1]] );

  for(let i = 0; i < scmNoArray.length; i++){
    console.log(scmNoArray[i]);
    await makeExcelWorkbook(scmNoArray[i], i);
  }
}

async function makeExcelWorkbook(scmNo, indexNo) {
  const wb = new excel.Workbook();
  await wb.xlsx.readFile('정산서양식.xlsx');
  const columnSetting = [
    {key:'brand_name', width: 12}, {key:'order_no', width: 15}, {key:'sno', width: 15}, {key:'customer_cellphone', width: 15},
    {key:'goods_code', width: 15}, {key:'goods_name', width: 20}, {key:'option_info', width: 20}, {key:'tax_type', width: 10},
    {key:'invoice_no', width: 15}, {key:'order_status', width: 15}, {key:'delivery_date', width: 20}, {key:'quantity', width: 9}, 
    {key:'tag_price', width: 15}, {key:'account_sale_price', width: 15}, {key:'discount_rate', width: 9},{key:'apply_commission', width: 9}, 
    {key:'commission_fee', width: 15}, {key:'company_paid', width: 15}
  ]

  //정산서 양식의 두번째 시트인 무무즈 국내 판매내역 시트의 내용 작성
  const ws2 = wb.getWorksheet('MOO_KR_sales');
  let data2 = await getData(sql.salesSql,scmNo[0]);
  ws2.columns = columnSetting;
  ws2.insertRows(5, data2, style = 'o+');

  //정산서 양식의 세번째 시트인 주문번호별 판매금액 합계와 이에 따른 배송비 계산 내용 작성
  const ws3 = wb.getWorksheet('MOO_KR_delivery')
  let data3 = await getData(sql.deliverySql, [scmNo[0],scmNo[0]]);
  ws3.columns = [
    {key:'order_no', width: 25}, {key:'order_delivery_sno', width: 15}, {key:'order_delivery_fee', width: 15}
  ];
  ws3.insertRows(5, data3, style = 'o+');

  //정산서 양식의 네번째 시트인 교환반품 배송비 내용 작성
  const ws4 = wb.getWorksheet('MOO_KR_claimDelivery');
  let data4 = await getData(sql.claimDeliverySql, scmNo[0]);
  ws4.columns = [
    {key:'delivery_fee_type', width: 15}, {key:'order_no', width: 25}, 
    {key:'order_delivery_sno', width: 15}, {key:'delivery_fee', width: 15}
  ];
  ws4.insertRows(5, data4, style = 'o+');

  //정산서 양식의 다섯번째 시트인 교환 내용 작성
  const ws5 = wb.getWorksheet('MOO_KR_exchange');
  let data5 = await getData(sql.exchangeSql, scmNo[0]);
  ws5.columns = columnSetting;
  ws5.insertRows(5, data5, style = 'o+');

  //정산서 양식의 여섯번째 시트인 반품환불 내용 작성
  const ws6 = wb.getWorksheet('MOO_KR_return');
  let data6 = await getData(sql.returnSql, scmNo[0]);
  ws6.columns = columnSetting;
  ws6.insertRows(5, data6, style = 'o+');

  //구글시트 작성을 위한 각 query 데이터의 합을 생성하는 query
  const saleTotalSum = await totalSum(data2);
  const exchangeTotalSum = await totalSum(data5);
  const returnTotalSum = await totalSum(data6);

  //배송비
  const orderDeliveryFeeSum = data3 == [] ? 0 : data3.reduce( (acc, cur) => acc + cur.order_delivery_fee, 0 );
  const claimDeliveryFeeSum = data4 == [] ? 0 : data4.reduce( (acc, cur) => acc + cur.delivery_fee, 0 );

  //정산서 양식의 첫번째 시트인 요약 시트의 내용 작성
  const ws1 = wb.getWorksheet('정산서');
  ws1.getCell('H2').value = calculateMonth;
  ws1.getCell('C3').value = scmNo[1];

  ws1.getCell('E11').value = saleTotalSum.taxationQuantity;
  ws1.getCell('F11').value = saleTotalSum.taxationSalePrice;
  ws1.getCell('G11').value = saleTotalSum.taxationCommissionFee;
  ws1.getCell('H11').value = saleTotalSum.taxationCompanyPaid;

  ws1.getCell('E12').value = (exchangeTotalSum.taxationQuantity + returnTotalSum.taxationQuantity) * -1;
  ws1.getCell('F12').value = (exchangeTotalSum.taxationSalePrice + returnTotalSum.taxationSalePrice) * -1;
  ws1.getCell('G12').value = (exchangeTotalSum.taxationCommissionFee + returnTotalSum.taxationCommissionFee) * -1;
  ws1.getCell('H12').value = (exchangeTotalSum.taxationCompanyPaid + returnTotalSum.taxationCompanyPaid) * -1;

  ws1.getCell('H13').value = orderDeliveryFeeSum;
  ws1.getCell('H14').value = claimDeliveryFeeSum;

  ws1.getCell('E21').value = saleTotalSum.taxfreeQuantity;
  ws1.getCell('F21').value = saleTotalSum.taxfreeSalePrice;
  ws1.getCell('G21').value = saleTotalSum.taxfreeCommissionFee;
  ws1.getCell('H21').value = saleTotalSum.taxfreeCompanyPaid;

  ws1.getCell('E22').value = (exchangeTotalSum.taxfreeQuantity + returnTotalSum.taxfreeQuantity) * -1;
  ws1.getCell('F22').value = (exchangeTotalSum.taxfreeSalePrice + returnTotalSum.taxfreeSalePrice) * -1;
  ws1.getCell('G22').value = (exchangeTotalSum.taxfreeCommissionFee + returnTotalSum.taxfreeCommissionFee) * -1;
  ws1.getCell('H22').value = (exchangeTotalSum.taxfreeCompanyPaid + returnTotalSum.taxfreeCompanyPaid) * -1;

  ws1.getCell('E10').value = ws1.getCell('E11').value + ws1.getCell('E12').value;
  ws1.getCell('F10').value = ws1.getCell('F11').value + ws1.getCell('F12').value;
  ws1.getCell('G10').value = ws1.getCell('G11').value + ws1.getCell('G12').value;
  ws1.getCell('H10').value = ws1.getCell('H11').value + ws1.getCell('H12').value + ws1.getCell('H13').value + ws1.getCell('H14').value;

  ws1.getCell('H19').value = ws1.getCell('H10').value + ws1.getCell('H15').value + ws1.getCell('H16').value + ws1.getCell('H17').value;

  ws1.getCell('E20').value = ws1.getCell('E21').value + ws1.getCell('E22').value;
  ws1.getCell('F20').value = ws1.getCell('F21').value + ws1.getCell('F22').value;
  ws1.getCell('G20').value = ws1.getCell('G21').value + ws1.getCell('G22').value;
  ws1.getCell('H20').value = ws1.getCell('H21').value + ws1.getCell('H22').value;

  gsWrite(client, indexNo, saleTotalSum, exchangeTotalSum, returnTotalSum, orderDeliveryFeeSum, claimDeliveryFeeSum);//구글시트 작성용 function 호출

  await wb.xlsx.writeFile('./정산서/' + paidCheckMonth + '월정산_' + scmNo[0] + "_" + scmNo[1] + '.xlsx');
  
  console.log("정산서 생성 완료");

  data2=[];
  data3=[];
  data4=[];
  data5=[];
  data6=[];
};

//mysql(mariaDB) query 실행 후 query값을 반환해주는 function
function getData(query, data) {
  return new Promise((resolve, reject) => {
    connection.query(query, data, (err, result) => {
        return err ? reject(err) : resolve(result);
    });
  });
}

async function totalSum(data) {
  const taxation = data.filter( d => d.tax_type == "과세");
  const taxationQuantity = taxation == [] ? 0 : taxation.reduce( (acc, cur) => acc + cur.quantity, 0 );
  const taxationTagPrice = taxation == [] ? 0 : taxation.reduce( (acc, cur) => acc + cur.tag_price, 0 );
  const taxationSalePrice = taxation == [] ? 0 : taxation.reduce( (acc, cur) => acc + cur.account_sale_price, 0 );
  const taxationCommissionFee = taxation == [] ? 0 : taxation.reduce( (acc, cur) => acc + cur.commission_fee, 0 );
  const taxationCompanyPaid = taxation == [] ? 0 : taxation.reduce( (acc, cur) => acc + cur.company_paid, 0 );

  const taxfree = data.filter( d => d.tax_type != "과세");
  const taxfreeQuantity = taxfree == [] ? 0 : taxfree.reduce( (acc, cur) => acc + cur.quantity, 0 );
  const taxfreeTagPrice = taxfree == [] ? 0 : taxfree.reduce( (acc, cur) => acc + cur.tag_price, 0 );
  const taxfreeSalePrice = taxfree == [] ? 0 : taxfree.reduce( (acc, cur) => acc + cur.account_sale_price, 0 );
  const taxfreeCommissionFee = taxfree == [] ? 0 : taxfree.reduce( (acc, cur) => acc + cur.commission_fee, 0 );
  const taxfreeCompanyPaid = taxfree == [] ? 0 : taxfree.reduce( (acc, cur) => acc + cur.company_paid, 0 );

  return {
    taxationQuantity, 
    taxationTagPrice, 
    taxationSalePrice, 
    taxationCommissionFee, 
    taxationCompanyPaid,
    taxfreeQuantity,
    taxfreeTagPrice,
    taxfreeSalePrice,
    taxfreeCommissionFee,
    taxfreeCompanyPaid
  }
}

//구글시트에 정산서의 요약 내용을 작성해주는 function
async function gsWrite(client, indexNo, saleTotalSum, exchangeTotalSum, returnTotalSum, orderDeliveryFeeSum, claimDeliveryFeeSum) {
  const gsapi = google.sheets({version : 'v4', auth : client});

  let sheetRow = indexNo + 5;
  
  const writeOption = {
    spreadsheetId: spreadsheetId,
    range: paidCheckYear + '-' + paidCheckMonth + '!C' + sheetRow,
    valueInputOption: 'USER_ENTERED',
    resource : {values : [
      [
        saleTotalSum.taxationTagPrice - exchangeTotalSum.taxationTagPrice - returnTotalSum.taxationTagPrice,
        saleTotalSum.taxationSalePrice - exchangeTotalSum.taxationSalePrice - returnTotalSum.taxationSalePrice,
        saleTotalSum.taxationCommissionFee - exchangeTotalSum.taxationCommissionFee - returnTotalSum.taxationCommissionFee,
        saleTotalSum.taxationCompanyPaid - exchangeTotalSum.taxationCompanyPaid - returnTotalSum.taxationCompanyPaid,
        orderDeliveryFeeSum,
        claimDeliveryFeeSum,
        saleTotalSum.taxfreeTagPrice - exchangeTotalSum.taxfreeTagPrice - returnTotalSum.taxfreeTagPrice,
        saleTotalSum.taxfreeSalePrice - exchangeTotalSum.taxfreeSalePrice - returnTotalSum.taxfreeSalePrice,
        saleTotalSum.taxfreeCommissionFee - exchangeTotalSum.taxfreeCommissionFee - returnTotalSum.taxfreeCommissionFee,
        saleTotalSum.taxfreeCompanyPaid - exchangeTotalSum.taxfreeCompanyPaid - returnTotalSum.taxfreeCompanyPaid,
      ]
    ]}
  };

  await gsapi.spreadsheets.values.update(writeOption);
}