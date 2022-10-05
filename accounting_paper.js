const {google} = require('googleapis');
const excel = require('exceljs');
const mysql = require('mysql');

const keys = require('./apikey.json');
const sql = require('./accounting_sql');
require('dotenv').config();

const paidCheckYear = 2022;
const paidCheckMonth = 9;
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
      range: paidCheckYear + '-' + paidCheckMonth + '!A5:U280' //해당월의 데이터 범위(정산업체수가 300개를 넘어갈 경우 더 늘려야함)
  };
  let data = await gsapi.spreadsheets.values.get(readOption);
  let scmNoArray = data.data.values.map( r => [r[0], r[1]] );

  for(let scmNo of scmNoArray){
    console.log(scmNo);
    await makeExcelWorkbook(scmNo);
  }
}

async function makeExcelWorkbook(scmNo) {
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
  let data3 = await getData(sql.deliverySql, [scmNo[0], scmNo[0]]);
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
  // let salesSum = await getData(``);
  // let deliveryFeeSum = await getData(``);
  // let claimDeliveryFeeSum = await getData(``);

  // if(typeof deliveryFeeSum[0] == 'undefined' ){
  //   deliveryFeeSum = [{_delivery_Fee: 0}];
  // }

  // if(typeof claimDeliveryFeeSum[0] == 'undefined' ){
  //   claimDeliveryFeeSum = [{_claim_delivery_fee: 0}];
  // }

  //정산서 양식의 첫번째 시트인 정산서 시트의 내용 작성
  const ws1 = wb.getWorksheet('정산서');

  // ws1.getCell('H2').value = calculateMonth;
  ws1.getCell('C3').value = scmNo[1];
  // ws1.getCell('D3').value = data1[0].supplier_name;
  // ws1.getCell('C4').value = data1[0].supplier_user_name;
  // ws1.getCell('C6').value = data1[0].supplier_user_email;
  // ws1.getCell('C7').value = data1[0].free_shipping_price;
  // ws1.getCell('D7').value = data1[0].shipping_fee;
  // ws1.getCell('F7').value = data1[0].exchange_shipping_fee;
  // ws1.getCell('H7').value = data1[0].return_shipping_fee;
  // for(let i=0; i < data1.length; i++) {
  //     ws1.getRow(8 + parseInt(i/5)).getCell(4 + i%5).value = data1[i].brand_name;
  // }

  // for (let i = 0; i < salesSum.length; i++){
  //   if(salesSum[i].product_tax_type === '과세상품'){
  //     ws1.getCell('E17').value = salesSum[i].quantity;
  //     ws1.getCell('F17').value = salesSum[i]._sales_price;
  //     ws1.getCell('G17').value = salesSum[i].commission_fee;
  //     ws1.getCell('H17').value = salesSum[i]._paid_price;
  //   }else{
  //     ws1.getCell('E25').value = salesSum[i].quantity;
  //     ws1.getCell('F25').value = salesSum[i]._sales_price;
  //     ws1.getCell('G25').value = salesSum[i].commission_fee;
  //     ws1.getCell('H25').value = salesSum[i]._paid_price;
  //   }
  // }

  // ws1.getCell('H18').value = deliveryFeeSum[0]._delivery_fee;
  // ws1.getCell('H19').value = claimDeliveryFeeSum[0]._claim_delivery_fee;

  // ws1.getCell('H24').value = ws1.getCell('H17').value + ws1.getCell('H18').value + ws1.getCell('H19').value;
  // ws1.getCell('H27').value = ws1.getCell('H25').value + ws1.getCell('H26').value;

  // gsWrite(client,partnerCode,dataArray,salesSum,deliveryFeeSum,claimDeliveryFeeSum);//구글시트 작성용 function 호출

  await wb.xlsx.writeFile('./정산서/' + paidCheckMonth + '월정산_' + scmNo[0] + "_" + scmNo[1] + '.xlsx');
  
  console.log("정산서 생성 완료");

  data1=[];
  data2=[];
  data3=[];
  data4=[];
  data5=[];
  // salesSum=[];
  // deliveryFeeSum=[];
  // claimDeliveryFeeSum=[];
  
};

//mysql(mariaDB) query 실행 후 query값을 반환해주는 function
function getData(query, data) {
  return new Promise((resolve, reject) => {
    connection.query(query, [data], (err, result) => {
        return err ? reject(err) : resolve(result);
    });
  });
}

//구글시트에 정산서의 요약 내용을 작성해주는 function
async function gsWrite(client,partnerCode,dataArray,salesSum,deliveryFeeSum,claimDeliveryFeeSum) {
  const gsapi = google.sheets({version : 'v4', auth : client});

  let sheetRow = dataArray.indexOf(partnerCode) + 5;
  
  const writeOption = {
    spreadsheetId: spreadsheetId,
    range: paidCheckYear + '-' + paidCheckMonth + '!G' + sheetRow,
    valueInputOption: 'USER_ENTERED',
    resource : {values : [[deliveryFeeSum[0]._delivery_fee,claimDeliveryFeeSum[0]._claim_delivery_fee]]}
  };

  await gsapi.spreadsheets.values.update(writeOption);

  let sheetRange = '';
  let sheetValues = [];

  for (let i = 0; i < salesSum.length; i++){
    if(salesSum[i].product_tax_type === '과세상품'){
      sheetRange = paidCheckYear + '-' + paidCheckMonth + '!C' + sheetRow;
      sheetValues = [salesSum[i].order_price_amount,salesSum[i]._sales_price,salesSum[i].commission_fee,salesSum[i]._paid_price];
    } else {
      sheetRange = paidCheckYear + '-' + paidCheckMonth + '!I' + sheetRow;
      sheetValues = [salesSum[i].order_price_amount,salesSum[i]._sales_price,salesSum[i].commission_fee,salesSum[i]._paid_price];
    }

    const writeOption = {
        spreadsheetId: spreadsheetId,
        range: sheetRange,
        valueInputOption: 'USER_ENTERED',
        resource : {values : [sheetValues]}
    };
    
    await gsapi.spreadsheets.values.update(writeOption);
  }
}