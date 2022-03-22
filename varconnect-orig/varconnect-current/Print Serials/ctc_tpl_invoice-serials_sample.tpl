<?xml version="1.0"?>
<!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">
<pdf>
	<head>
		<link name="NotoSans" type="font" subtype="truetype" src="${nsfont.NotoSans_Regular}" src-bold="${nsfont.NotoSans_Bold}" src-italic="${nsfont.NotoSans_Italic}" src-bolditalic="${nsfont.NotoSans_BoldItalic}" bytes="2" />
		<#if .locale=="zh_CN">
			<link name="NotoSansCJKsc" type="font" subtype="opentype" src="${nsfont.NotoSansCJKsc_Regular}" src-bold="${nsfont.NotoSansCJKsc_Bold}" bytes="2" />
			<#elseif .locale=="zh_TW">
				<link name="NotoSansCJKtc" type="font" subtype="opentype" src="${nsfont.NotoSansCJKtc_Regular}" src-bold="${nsfont.NotoSansCJKtc_Bold}" bytes="2" />
				<#elseif .locale=="ja_JP">
					<link name="NotoSansCJKjp" type="font" subtype="opentype" src="${nsfont.NotoSansCJKjp_Regular}" src-bold="${nsfont.NotoSansCJKjp_Bold}" bytes="2" />
					<#elseif .locale=="ko_KR">
						<link name="NotoSansCJKkr" type="font" subtype="opentype" src="${nsfont.NotoSansCJKkr_Regular}" src-bold="${nsfont.NotoSansCJKkr_Bold}" bytes="2" />
						<#elseif .locale=="th_TH">
							<link name="NotoSansThai" type="font" subtype="opentype" src="${nsfont.NotoSansThai_Regular}" src-bold="${nsfont.NotoSansThai_Bold}" bytes="2" />
						</#if>
						<macrolist>
							<macro id="nlheader">
								<table class="header" style="width: 100%;" table-layout="fixed">
									<tr>
										<td rowspan="2" colspan="1" width="22%">
											<#if companyInformation.logoUrl?length !=0>
<#if fromSuitelet?has_content>
<img src="${companyInformation.logoUrl}" style="float: left; margin:0 7px" width="60%" height="60%" />
											<#else>
												<img src="${companyInformation.logoUrl}" style="float: left; margin:0 7px" width="60%" height="60%" />
											</#if>											<!-- #if fromSuitelet?has_content -->
										</#if>										<!-- #if companyInformation.logoUrl?length !=0 -->
									</td>
									<td rowspan="2" colspan="1">
										<span class="nameandaddress">${subsidiary.name}</span>
										<br />
										<span class="nameandaddress">${subsidiary.mainaddress_text}</span>
									</td>
									<td width="30%" align="right" colspan="1">
										<span class="title">${record@title}</span>
									</td>
								</tr>
								<tr>
									<td>
										<table class="header" style="width: 100%;" table-layout="auto">
											<tr>
												<td align="center" colspan="1" border-top="1" border-left="1" style="padding-top: 5px; background-color: #e3e3e3;">${record.trandate@label}</td>
												<td align="center" colspan="1" border-top="1" border-left="1" border-right="1" style="padding-top: 5px; background-color: #e3e3e3;">${record@title}</td>
											</tr>
											<tr>
												<td align="center" colspan="1" border-top="1" border-left="1" border-bottom="1" style="padding:5px 2px;white-space:nowrap;">${record.trandate}</td>
												<td align="center" colspan="1" border-top="1" border-left="1" border-right="1" border-bottom="1" style="padding: 5px 2px; white-space:nowrap;">${record.tranid}</td>
											</tr>
										</table>
									</td>
								</tr>
							</table>
						</macro>
					</macrolist>
					<style type="text/css">
			* {
						<#if .locale=="zh_CN">font-family: NotoSans, NotoSansCJKsc, sans-serif;
							<#elseif .locale=="zh_TW">font-family: NotoSans, NotoSansCJKtc, sans-serif;
								<#elseif .locale=="ja_JP">font-family: NotoSans, NotoSansCJKjp, sans-serif;
									<#elseif .locale=="ko_KR">font-family: NotoSans, NotoSansCJKkr, sans-serif;
										<#elseif .locale=="th_TH">font-family: NotoSans, NotoSansThai, sans-serif;
											<#else>font-family: NotoSans, sans-serif;
											</#if>
			}

			table {
				font-size: 9pt;
				table-layout: fixed;
				line-height: 110%;
			}

			th {
				font-weight: bold;
				font-size: 8pt;
				vertical-align: middle;
				padding: 5px 6px 3px;
				background-color: #e3e3e3;
				color: #333333;
			}

			td {
				padding: 4px 6px;
			}

			td p {
				align: left
			}

			b {
				font-weight: bold;
				color: #333333;
			}

			table.header td {
				padding: 0px;
				font-size: 10pt;
			}

			table.footer td {
				padding: 0px;
				font-size: 8pt;
			}

			table.itemtable th {
				padding-bottom: 10px;
				padding-top: 10px;
			}

			table.body td {
				padding-top: 2px;
			}

			table.total {
				page-break-inside: avoid;
			}

			tr.totalrow {
				background-color: #e3e3e3;
				line-height: 200%;
			}

			td.totalboxtop {
				font-size: 12pt;
				background-color: #e3e3e3;
			}

			td.addressheader {
				font-size: 8pt;
				padding-top: 6px;
				padding-bottom: 2px;
			}

			td.address {
				padding-top: 0px;
			}

			td.totalboxmid {
				font-size: 28pt;
				padding-top: 20px;
				background-color: #e3e3e3;
			}

			td.totalboxbot {
				background-color: #e3e3e3;
				font-weight: bold;
			}

			span.title {
				font-size: 28pt;
			}

			span.number {
				font-size: 16pt;
			}

			span.itemname {
				font-weight: bold;
				line-height: 150%;
			}

			hr {
				width: 100%;
				color: #d3d3d3;
				background-color: #d3d3d3;
				height: 1px;
			}

			table.items {
                line-height: 130%;
            }

            a {
                text-decoration:none;
            }

			table.serials tr td {
				border:1px dotted #666;
			}

										</style>
									</head>

									<body header="nlheader" header-height="10%" footer="nlfooter" footer-height="10pt" padding="0.5in 0.5in 0.5in 0.5in" size="Letter">

										<table align="right" style="width: 100%; padding-top: 40px;">
											<tr>
												<td border-top="1" border-right="1" border-left="1" border-bottom="1" style="background-color: #e3e3e3;">
													<b>${record.billaddress@label}</b>
												</td>
												<td></td>
												<td border-top="1" border-right="1" border-left="1" border-bottom="1" style="background-color: #e3e3e3;">
													<b>${record.shipaddress@label}</b>
												</td>
											</tr>
											<tr>
												<td rowspan="2" border-right="1" border-left="1" border-bottom="1">${record.billaddress}</td>
												<td rowspan="2"></td>
												<td border-right="1" border-left="1">
                    ${record.shipaddress}
												</td>
											</tr>
											<tr>
												<td border-right="1" border-left="1" border-bottom="1" <#if record.custbody_ctc_contact_name!=''>border-top="1"</#if>>
												<#if record.custbody_ctc_contact_name!=''>
													<b>${record.custbody_ctc_contact_name}</b>
													<#if record.custbody_ctc_select_contact.email!=''>
														<br />
${record.custbody_ctc_select_contact.email} </#if>
													<#if record.custbody_ctc_select_contact.phone!=''>
														<br />
${record.custbody_ctc_select_contact.phone} </#if>
												</#if>
											</td>
										</tr>
									</table>

									<table style="width: 100%; margin-top: 10px; padding-top: 10px;" table-layout="auto">
										<tr>
											<th border-top="1" border-right="1" border-left="1" border-bottom="1">${record.otherrefnum@label}</th>
											<th border-top="1" border-right="1" border-bottom="1">Sales Order #</th>
											<th border-top="1" border-right="1" border-bottom="1">${record.salesrep@label}</th>
											<th border-top="1" border-right="1" border-bottom="1">Ship Date</th>
											<th border-top="1" border-right="1" border-bottom="1">${record.terms@label}</th>
											<th border-top="1" border-right="1" border-bottom="1">Due Date</th>
											<th border-top="1" border-right="1" border-bottom="1">Shipping<br />
Method</th>
										</tr>
										<tr>
											<td border-right="1" border-left="1" border-bottom="1">${record.otherrefnum}</td>
											<td border-right="1" border-bottom="1">${record.createdfrom.tranid}</td>
											<td border-right="1" border-bottom="1">${record.salesrep.firstname} ${record.salesrep.lastname}</td>
											<td border-right="1" border-bottom="1">${record.custbody_ctc_ship_date}</td>
											<td border-right="1" border-bottom="1">${record.terms}</td>
											<td border-right="1" border-bottom="1">${record.duedate}</td>
											<td border-right="1" border-bottom="1">${record.shipmethod}</td>
										</tr>
									</table>
									<#assign shippingAmount = 0>
<#assign hasShipppingLine = false>
<#if record.item?has_content>
<table border-bottom="1" border-top="1" style="width: 100%;margin-top:5px;" class="items">
										<!-- start items -->
										<#list record.item as item>
<#if item_index==0>
<thead>
<tr>
<th border-right="1" border-left="1" border-bottom="1" colspan="4">${item.item@label}</th>
										<th border-right="1" border-bottom="1" colspan="1">Qty</th>
										<th border-right="1" border-bottom="1" colspan="8">${item.description@label}</th>
										<th border-right="1" border-bottom="1" colspan="3">${item.rate@label}</th>
										<th border-right="1" border-bottom="1" colspan="1">${item.istaxable@label}</th>
										<th border-right="1" border-bottom="1" colspan="3">${item.amount@label}</th>
									</tr>
								</thead>
							</#if>
							<#if item.item?lower_case?matches('shipping.*')>
<#assign shippingAmount = shippingAmount + item.amount>
<#assign hasShipppingLine = true>
<#else>
<tr>
<td border-right="1" border-left="1" colspan="4">${item.item}</td>
							<td border-right="1" colspan="1" align="right">${item.quantity}</td>
							<td border-right="1" colspan="8">${item.description}</td>
							<td border-right="1" colspan="3" align="right">${item.rate}</td>
							<td border-right="1" colspan="1">${item.istaxable}</td>
							<td border-right="1" colspan="3" align="right">${item.amount}</td>
						</tr>
						<#if (item.custcol3?has_content || item.custcol_ctc_renewalend?has_content)>
<tr>
<td border-right="1" border-left="1" colspan="4">&nbsp;</td>
						<td border-right="1" colspan="1">&nbsp;</td>
						<td colspan="4">
							<b>RENEWAL START: </b> ${item.custcol3}</td>
						<td border-right="1" colspan="4">
							<b>RENEWAL END: </b> ${item.custcol_ctc_renewalend}</td>
						<td border-right="1" colspan="3">&nbsp;</td>
						<td border-right="1" colspan="1">&nbsp;</td>
						<td border-right="1" colspan="3">&nbsp;</td>
					</tr>
				</#if>
				<#if (item.custcol_ctc_renewal_serial_numbers?has_content)>
<tr>
<td border-right="1" border-left="1" colspan="4">&nbsp;</td>
				<td border-right="1" colspan="1">&nbsp;</td>
				<td border-right="1" colspan="8">
					<b>RENEWAL SERIALS: </b> ${item.custcol_ctc_renewal_serial_numbers}</td>
				<td border-right="1" colspan="3">&nbsp;</td>
				<td border-right="1" colspan="1">&nbsp;</td>
				<td border-right="1" colspan="3">&nbsp;</td>
			</tr>
		</#if>
	</#if>
</#list><!-- end items -->
</table>
</#if>

<#assign rowspanCount=1 />
<table border-bottom="1" border-top="1" style="width: 100%;margin-top:5px;">
<tr>
<td border-right="1" border-left="1" rowspan="5" colspan="3">&nbsp;</td>
<td border-right="1" align="right">
	<b>${record.subtotal@label}&nbsp;</b>
</td>
<td border-right="1" align="right">${record.subtotal}&nbsp;</td>
</tr>
<#if (record.shippingcost?has_content || hasShipppingLine) >
<#assign rowspanCount=rowspanCount + 1 />
<#assign shippingAmount = shippingAmount + record.shippingcost />
<#if (shippingAmount?is_string)>
<#assign shippingAmount = shippingAmount?number />
</#if>
<tr>
<td border-right="1" align="right">
<b>Shipping &amp; Handling&nbsp;</b>
</td>
<td border-right="1" align="right">${shippingAmount?string.currency}&nbsp;</td>
</tr>
</#if>
<#if record.taxtotal?has_content>
<#assign rowspanCount=rowspanCount + 1 />
<tr>
<td border-right="1" align="right">
<b>${record.taxtotal@label}&nbsp;</b>
</td>
<td border-right="1" align="right">${record.taxtotal}&nbsp;</td>
</tr>
</#if>
<#if record.total?has_content>
<#assign rowspanCount=rowspanCount + 1 />
<tr>
<td border-right="1" align="right">
<b>${record.total@label}&nbsp;</b>
</td>
<td border-right="1" align="right">${record.total}&nbsp;</td>
</tr>
</#if>
<#if record.amountremaining?has_content>
<#assign rowspanCount=rowspanCount + 1 />
<tr>
<td border-right="1" align="right">
<b>${record.amountremaining@label}&nbsp;</b>
</td>
<td border-right="1" align="right">${record.amountremaining}&nbsp;</td>
</tr>
</#if>
<#if (rowspanCount lt 5)>
<#list rowspanCount+1..5 as idx>
<tr>
<td border-right="1" align="right">&nbsp;</td>
<td border-right="1" align="right">&nbsp;</td>
</tr>
</#list>
</#if>
</table>

<!-- START INVOICE SERIALS CODE  -->

<!-- config -->
<#assign VC_SerialsMacro_ScriptUrl = "script=103&deploy=1&h=2c582840e4c29e28b614" />
<#assign VC_SerialsTable_NumCols = 5 />
<!-- config:end -->

<!-- serials macro:start -->
<#assign VC_SerialsUrl = [companyinformation.formsurl?replace("<.*?>", "", "ri"),
		    "/app/site/hosting/scriptlet.nl?", VC_SerialsMacro_ScriptUrl,
		    "&compid=",companyinformation.companyid,
			"&recid=", record.internalid,
		    "&rectype=invoice",
		    "&mkey=invoiceserials"]?join("") >
<#import VC_SerialsUrl as VC_SerialsImport />
<#assign VC_SerialsImportJSON><@VC_SerialsImport.serials /></#assign>
<#assign VC_InvoiceSerials=[] />

<#if VC_SerialsImportJSON != ''>
<#assign VC_InvoiceSerials=VC_SerialsImportJSON?eval />
</#if>
<!-- serials macro:end -->


<!-- serials table:start -->
<#if VC_InvoiceSerials?has_content>
<#assign itemName = '' />
<#assign numCols = VC_SerialsTable_NumCols />
<#assign colCnt = 1 />

<table class="serials" table-layout="auto" style="width: 100%;margin-top:10px;align:center;">

<#list VC_InvoiceSerials?sort_by("itemName") as serialline>

<#if (itemName != serialline.itemName) >
<#if itemName != ''>
<!-- fill up empty columns -->
<#if (colCnt > 1) ><#list 0..numCols-colCnt as cnt><td>&nbsp;</td></#list></#if>
</tr>
</#if><!-- #if itemName != '' -->
<tr style="margin-top:10px; border-bottom: 1px solid #000;">
<th colspan="${numCols}">${serialline.itemName} Serial Number(s) </th>
</tr>
<tr>
<#assign itemName = serialline.itemName />
<#assign colCnt = 1 />
</#if>

<td align="center">
<span style="white-space:nowrap;" align="center">${serialline.serialno}</span>
</td>

<!-- column breaker -->
<#if (colCnt == numCols)>
</tr><tr>
<#assign colCnt=1 />
<#else>
<#assign colCnt+=1 />
</#if>

</#list><!-- #list VC_InvoiceSerials?sort_by("itemName") as serialline -->

<!-- fill up empty columns -->
<#if (colCnt > 1) ><#list 0..numCols-colCnt as cnt><td>&nbsp;</td></#list></#if>

</tr>
</table>
<hr />
</#if><!-- #if VC_InvoiceSerials?has_content -->
<!-- serials table:end-->

<!-- END INVOICE SERIALS CODE  -->


</body>
</pdf>
