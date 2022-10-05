module.exports = {
  salesSql: `SELECT b.brand_name
	, a.order_no 
	, a.sno
	, insert (a.order_cellphone,6,2,'**') as customer_cellphone
	, a.goods_code
	, a.goods_name
  , a.option_info
	, IF(substring(a.tax_free_flag,1,1) = "t","과세","면세") as tax_type
	, a.invoice_no
	, a.order_status
	, date(a.delivery_date) AS delivery_date
	, a.goods_count as quantity
	, (a.fixed_price * a.goods_count) as tag_price
	, @account_sale_price:=(a.goods_sno_price - a.goods_discount) as account_sale_price
	, @discount_rate:=round(1 - (@account_sale_price/(a.fixed_price * a.goods_count)),3) as discount_rate
	, @basic_commission:=
      CASE 
        WHEN @discount_rate = 0 THEN round(c.grade_0,3)
        WHEN @discount_rate < 0.1 THEN round(c.grade_1,3)
        WHEN @discount_rate <= 0.2 THEN round(c.grade_2,3)
        WHEN @discount_rate <= 0.3 THEN round(c.grade_3,3)
        WHEN @discount_rate <= 0.4 THEN round(c.grade_4,3)
        WHEN @discount_rate <= 0.5 THEN round(c.grade_5,3)
        WHEN @discount_rate <= 0.6 THEN round(c.grade_6,3)
        WHEN @discount_rate <= 0.7 THEN round(c.grade_7,3)
        WHEN @discount_rate <= 0.8 THEN round(c.grade_8,3)
        WHEN @discount_rate <= 0.9 THEN round(c.grade_9,3)
      ELSE round(c.grade_10,3)
      END AS basic_commission
    , @adjust_commission:=round(IF((a.payment_date > d.start_date) AND (a.payment_date < d.end_date), d.adjust_commission, NULL),3) AS adjust_commission
    , @apply_commission:=if(@adjust_commission IS NULL, @basic_commission, @adjust_commission) AS apply_commission
    , @commission_fee:=round(@account_sale_price * @apply_commission,0) as commission_fee
    , @account_sale_price - @commission_fee as company_paid
  FROM gododb.accounting_sales a
    LEFT JOIN gododb.august_accounted_sales e USING(sno) 
    LEFT JOIN gododb.brand_codes b ON a.brand_code = b.brand_code
    LEFT JOIN gododb.commission_codes c USING(commission_code)
    LEFT JOIN gododb.adjust_commissions d ON a.goods_no = d.goods_no
      AND IF((a.payment_date > d.start_date) AND (a.payment_date < d.end_date), d.adjust_commission, NULL) IS NOT NULL
  WHERE a.scm_no = ? AND e.check_account IS NULL`,

  deliverySql: `SELECT a.order_no
  , a.order_delivery_sno
  , ROUND(SUM(a.order_delivery_fee) / COUNT(a.order_delivery_fee),0) as order_delivery_fee
  FROM gododb.order_sales_for_delivery a
  WHERE a.scm_no = ? AND a.order_delivery_sno IN (
    SELECT a.order_delivery_sno
    FROM gododb.accounting_sales a 
      LEFT JOIN gododb.august_delivery_fees b USING(order_delivery_sno)
    WHERE a.scm_no = ? AND b.check_account IS NULL
    GROUP BY a.order_delivery_sno)
  GROUP BY a.order_delivery_sno, a.order_no`,

  claimDeliverySql: `SELECT a.delivery_fee_type
  , a.order_no
  , a.order_delivery_sno
  , a.delivery_fee
  FROM gododb.claim_delivery_fees a
    LEFT JOIN gododb.august_delivery_fees b USING(order_delivery_sno)
  WHERE a.scm_no = ? AND b.check_account IS NULL`,

  exchangeSql: `SELECT b.brand_name
	, a.order_no 
	, a.sno
	, insert (a.order_cellphone,6,2,'**') as customer_cellphone
	, a.goods_code
	, a.goods_name
  , a.option_info
	, IF(substring(a.tax_free_flag,1,1) = "t","과세","면세") as tax_type
	, a.invoice_no
	, a.order_status
	, date(a.delivery_date) AS delivery_date
	, a.goods_count as quantity
	, (a.fixed_price * a.goods_count) as tag_price
	, @account_sale_price:=(a.goods_sno_price - a.goods_discount) as account_sale_price
	, @discount_rate:=round(1 - (@account_sale_price/(a.fixed_price * a.goods_count)),3) as discount_rate
	, @basic_commission:=
      CASE 
        WHEN @discount_rate = 0 THEN round(c.grade_0,3)
        WHEN @discount_rate < 0.1 THEN round(c.grade_1,3)
        WHEN @discount_rate <= 0.2 THEN round(c.grade_2,3)
        WHEN @discount_rate <= 0.3 THEN round(c.grade_3,3)
        WHEN @discount_rate <= 0.4 THEN round(c.grade_4,3)
        WHEN @discount_rate <= 0.5 THEN round(c.grade_5,3)
        WHEN @discount_rate <= 0.6 THEN round(c.grade_6,3)
        WHEN @discount_rate <= 0.7 THEN round(c.grade_7,3)
        WHEN @discount_rate <= 0.8 THEN round(c.grade_8,3)
        WHEN @discount_rate <= 0.9 THEN round(c.grade_9,3)
      ELSE round(c.grade_10,3)
      END AS basic_commission
    , @adjust_commission:=round(IF((a.payment_date > d.start_date) AND (a.payment_date < d.end_date), d.adjust_commission, NULL),3) AS adjust_commission
    , @apply_commission:=if(@adjust_commission IS NULL, @basic_commission, @adjust_commission) AS apply_commission
    , @commission_fee:=round(@account_sale_price * @apply_commission,0) as commission_fee
    , @account_sale_price - @commission_fee as company_paid
  FROM gododb.exchange_sales a
    LEFT JOIN gododb.brand_codes b ON a.brand_code = b.brand_code
    LEFT JOIN gododb.commission_codes c USING(commission_code)
    LEFT JOIN gododb.adjust_commissions d ON a.goods_no = d.goods_no
      AND IF((a.payment_date > d.start_date) AND (a.payment_date < d.end_date), d.adjust_commission, NULL) IS NOT NULL
  WHERE a.scm_no = ? AND DATE(a.delivery_date) != "0000-00-00"`,

  returnSql: `SELECT b.brand_name
	, a.order_no 
	, a.sno
	, insert (a.order_cellphone,6,2,'**') as customer_cellphone
	, a.goods_code
	, a.goods_name
  , a.option_info
	, IF(substring(a.tax_free_flag,1,1) = "t","과세","면세") as tax_type
	, a.invoice_no
	, a.order_status
	, date(a.delivery_date) AS delivery_date
	, a.goods_count as quantity
	, (a.fixed_price * a.goods_count) as tag_price
	, @account_sale_price:=(a.goods_sno_price - a.goods_discount) as account_sale_price
	, @discount_rate:=round(1 - (@account_sale_price/(a.fixed_price * a.goods_count)),3) as discount_rate
	, @basic_commission:=
      CASE 
        WHEN @discount_rate = 0 THEN round(c.grade_0,3)
        WHEN @discount_rate < 0.1 THEN round(c.grade_1,3)
        WHEN @discount_rate <= 0.2 THEN round(c.grade_2,3)
        WHEN @discount_rate <= 0.3 THEN round(c.grade_3,3)
        WHEN @discount_rate <= 0.4 THEN round(c.grade_4,3)
        WHEN @discount_rate <= 0.5 THEN round(c.grade_5,3)
        WHEN @discount_rate <= 0.6 THEN round(c.grade_6,3)
        WHEN @discount_rate <= 0.7 THEN round(c.grade_7,3)
        WHEN @discount_rate <= 0.8 THEN round(c.grade_8,3)
        WHEN @discount_rate <= 0.9 THEN round(c.grade_9,3)
      ELSE round(c.grade_10,3)
      END AS basic_commission
    , @adjust_commission:=round(IF((a.payment_date > d.start_date) AND (a.payment_date < d.end_date), d.adjust_commission, NULL),3) AS adjust_commission
    , @apply_commission:=if(@adjust_commission IS NULL, @basic_commission, @adjust_commission) AS apply_commission
    , @commission_fee:=round(@account_sale_price * @apply_commission,0) as commission_fee
    , @account_sale_price - @commission_fee as company_paid
  FROM gododb.return_sales a
    LEFT JOIN gododb.brand_codes b ON a.brand_code = b.brand_code
    LEFT JOIN gododb.commission_codes c USING(commission_code)
    LEFT JOIN gododb.adjust_commissions d ON a.goods_no = d.goods_no
      AND IF((a.payment_date > d.start_date) AND (a.payment_date < d.end_date), d.adjust_commission, NULL) IS NOT NULL
  WHERE a.scm_no = ? AND DATE(a.delivery_date) != "0000-00-00"`,

}