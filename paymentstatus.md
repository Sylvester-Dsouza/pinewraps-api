Retrieve order status
You may query the N-Genius Online APIs to retrieve the status/outcome of any order, at any time. Doing so will provide you not only with a full breakdown of the order object, but it will also provide easy-to-use links to any follow-up request you may wish to execute.

HTTP Request Method: GET
Resource (URI): https://api-gateway.sandbox.ngenius-payments.com/transactions/outlets/[outlet-reference]/orders/[order-reference]

Headers:
Header	Value
Authorization	Bearer [access_token]
Please note that, for the following request types (including this one), no message body data is required, since the HTTP method is either GET or DELETE:

retrieving an order status
executing authorization reversals
cancellation of captures
cancellation of refunds
Example response (body):

JSON

{
  "_id": "urn:order:[order-reference]",
"_links": {
"self": { "href": "[order resource URI]" },
"tenant-brand": { "href": "[service provider brand resource URI]" },
"payment": { "href": "[payment page resource URI]"},
"merchant-brand": { "href": "[your branding resource URI]" }
},
"action": "[action]",
"amount": {
"currencyCode": "[amount.currencyCode]",
"value": [amount.value]
},
"language": "[language]",
"merchantAttributes": {
"redirectUrl": "[your redirect URL]"
},
"reference": "[order-reference]",
"outletId": "[outlet-reference]",
"createDateTime": "[timestamp]",
"paymentMethods": {
"card": [available payment methods]
},
"formattedOrderSummary": {},
"formattedAmount": "[formatted order amount, i.e. AED10.00]",
"_embedded": {
"payment": [
{
"_id": "urn:payment:[payment resource URI]",
"_links": {
"payment:card": { "href": "[direct card payment URI]" } },
"outletId": "[outlet-reference]",
"orderReference": "[order-reference]",
"state": "[state]",
"amount": {
"currencyCode": "[amount.currencyCode]",
"value": [amount.value]
},
"updateDateTime": "[timestamp]"
}
]
}
}