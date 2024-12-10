Getting started
Your service account API key and outlet reference
By now, you should have been provided with an N-Genius Online Portal login. If you have not been provided with this login, please contact your N-Genius Online Portal administrator, which may be someone in your own company.

In order to integrate with the N-Genius Online payment APIs, you will need to generate a Service Account API key. To do so, first log-in to the N-Genius Online Portal, and navigate to the Settings > Integration > Service Accounts section, then click ‘New’.

1261
You will then be prompted to enter the following details:

Name: a simple, memorable short name for your API key.
Description: a longer description for your API key, useful if you plan on using multiple keys.
Once you have defined a Service Account API key, you should then make a note of the outlet reference for your trading outlet. To find this, navigate to Settings > Organizational Hierarchy and select an outlet from the left-hand panel.

Outlets are denoted by a small, unfilled square icon:

51
Once an outlet is selected, the outlet reference will then be displayed in the right-hand panel.

1231
You will need both the API key and the outlet reference for your N-Genius Online account to proceed with the integration guides contained in this document, so be sure to take a note of them.


##Next Step

Request an access token
This section will describe how you will authenticate yourself to the N-Genius Online identity services, and receive an access token in return, which you can then use to perform more meaningful operations using the N-Genius Online payment APIs.

Request an access token
The first step for any N-Genius Online gateway interaction is to validate ourselves with the identity service and obtain an access token. This token allows us to execute operations on the gateway APIs with authority, and whilst a single token will expire after 5 minutes, we can use our Service Account API key to generate one at any time.

HTTP Request Method: POST
Resource (URI): https://api-gateway.sandbox.ngenius-payments.com/identity/auth/access-token

Headers:
Add these headers to your request (note that you should replace 'your_api_key' with the service account API key in the Getting started section).

Header	Value
Content-Type	application/vnd.ni-identity.v1+json
Authorization	Basic your_api_key
Example response (body):
JSON

{     
  "access_token": "eyJhbGciOiJSUzI1N…0eDloZnVRI",     
  "expires_in": 300,     
  "refresh_expires_in": 1800,     
  "refresh_token": "eyJhbGciOi…eDloZnVRIn0",
  "token_type": "bearer"
}
Code example (PHP + cURL):
PHP
Text

$apikey = "[your-api-key]";		// enter your API key here
$ch = curl_init(); 
curl_setopt($ch, CURLOPT_URL, "https://api-gateway.sandbox.ngenius-payments.com/identity/auth/access-token"); 
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    "accept: application/vnd.ni-identity.v1+json",
    "authorization: Basic ".$apikey,
    "content-type: application/vnd.ni-identity.v1+json"
   )); 
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);   
curl_setopt($ch, CURLOPT_POST, 1); 
curl_setopt($ch, CURLOPT_POSTFIELDS,  "{\"realmName\":\"ni\"}"); 
$output = json_decode(curl_exec($ch)); 
$access_token = $output->access_token;
Note: you will require the access_token value for any subsequent calls to the N-Genius Online platform APIs.



Next Step

Create an order
Creating an order
Now that an access token has been provided, we are now able to create orders in the N-Genius Online gateway. To accept a payment from a customer, an order is always required so that we have something to interact with in all our API interactions with the gateway, and on the Portal user interface.

HTTP Request Method: POST
Resource (URI): https://api-gateway.sandbox.ngenius-payments.com/transactions/outlets/[your-outlet-reference]/orders

Headers:
Add these headers to your request (note that you should replace 'access_token' with the access token value we received from the Obtain an access token step).

Header	Value
Authorization	Bearer access_token
Content-Type	application/vnd.ni-payment.v2+json
Accept	application/vnd.ni-payment.v2+json
Body:
Add the following JSON information to the form/body content of your request.

Parameter	Description	Example value
action	Order type	"AUTH", "SALE", "PURCHASE"
amount { }	Amount block	N/A
amount.currencyCode	Order currency	"AED", "USD", "EUR"
amount.value	Order amount	1000 (minor units)
emailAddress	Payer's email address	customer@test.com
Note: these are the mandatory minimum input parameters for creating an order using the N-Genius Online gateway APIs - many more values are available. Please consult the List of order input attributes section for a complete list of these parameters.

 Orders created with the ‘PURCHASE’ action will, if successfully authorized, automatically and immediately attempt to capture/settle the full order amount, whereas orders created with the ‘AUTH’ action will await some further action from instructing N-Genius Online to capture/settle the funds.

Unless you are ready to ship your goods/services immediately, or you are selling digital content, we recommend you use the ‘AUTH’ action and capture your customers’ successful authorizations when you are ready to ship the goods to your customer.

Example request (body):
JSON

{  
  "action": "PURCHASE",   
  "amount" : { "currencyCode" : "AED", "value" : 100 } 
}
Example response (body):
JSON

{
  "_id": "urn:order:76fb9d52-a3ef-42d3-8b4e-90092f57534c",
  "_links": {
    "cnp:payment-link": {
      "href": "https://api-gateway.sandbox.ngenius-payments.com/transactions/outlets/5edab6d7-5946-43f4-b8c7-06b29c272bdd/orders/76fb9d52-a3ef-42d3-8b4e-90092f57534c/payment-link"
    },
    "payment-authorization": {
      "href": "https://api-gateway.sandbox.ngenius-payments.com/transactions/paymentAuthorization"
    },
    "self": {
      "href": "https://api-gateway.sandbox.ngenius-payments.com/transactions/outlets/5edab6d7-5946-43f4-b8c7-06b29c272bdd/orders/76fb9d52-a3ef-42d3-8b4e-90092f57534c"
    },
    "tenant-brand": {
      "href": "http://config-service/config/outlets/5edab6d7-5946-43f4-b8c7-06b29c272bdd/configs/tenant-brand"
    },
    "payment": {
      "href": "https://paypage.sandbox.ngenius-payments.com/?code=8ad2daf8bc86d0a9"
    },
    "merchant-brand": {
      "href": "http://config-service/config/outlets/5edab6d7-5946-43f4-b8c7-06b29c272bdd/configs/merchant-brand"
    }
  },
  "action": "PURCHASE",
  "amount": {
    "currencyCode": "AED",
    "value": 1000
  },
  "language": "en",
  "merchantAttributes": {
    "redirectUrl": "https://yoursite.com"
  },
  "emailAddress": "",
  "reference": "76fb9d52-a3ef-42d3-8b4e-90092f57534c",
  "outletId": "5edab6d7-5946-43f4-b8c7-06b29c272bdd",
  "createDateTime": "2019-04-17T08:15:18.912Z",
  "paymentMethods": {
    "card": [
      "DINERS_CLUB_INTERNATIONAL",
      "AMERICAN_EXPRESS",
      "MASTERCARD",
      "MASTERCARD",
      "VISA",
      "VISA"
    ],
    "wallet": [
      "APPLE_PAY",
      "SAMSUNG_PAY"
    ]
  },
  "referrer": "urn:Ecom:76fb9d52-a3ef-42d3-8b4e-90092f57534c",
  "formattedAmount": "د.إ.‏ 10",
  "formattedOrderSummary": {},
  "_embedded": {
    "payment": [
      {
        "_id": "urn:payment:2fff837f-9a39-4a02-8435-9aaa7cb6b558",
        "_links": {
          "payment:apple_pay": {
            "href": "https://api-gateway.sandbox.ngenius-payments.com/transactions/outlets/5edab6d7-5946-43f4-b8c7-06b29c272bdd/orders/76fb9d52-a3ef-42d3-8b4e-90092f57534c/payments/2fff837f-9a39-4a02-8435-9aaa7cb6b558/apple-pay"
          },
          "self": {
            "href": "https://api-gateway.sandbox.ngenius-payments.com/transactions/outlets/5edab6d7-5946-43f4-b8c7-06b29c272bdd/orders/76fb9d52-a3ef-42d3-8b4e-90092f57534c/payments/2fff837f-9a39-4a02-8435-9aaa7cb6b558"
          },
          "payment:card": {
            "href": "https://api-gateway.sandbox.ngenius-payments.com/transactions/outlets/5edab6d7-5946-43f4-b8c7-06b29c272bdd/orders/76fb9d52-a3ef-42d3-8b4e-90092f57534c/payments/2fff837f-9a39-4a02-8435-9aaa7cb6b558/card"
          },
          "payment:samsung_pay": {
            "href": "https://api-gateway.sandbox.ngenius-payments.com/transactions/outlets/5edab6d7-5946-43f4-b8c7-06b29c272bdd/orders/76fb9d52-a3ef-42d3-8b4e-90092f57534c/payments/2fff837f-9a39-4a02-8435-9aaa7cb6b558/samsung-pay"
          },
          "payment:saved-card": {
            "href": "https://api-gateway.sandbox.ngenius-payments.com/transactions/outlets/5edab6d7-5946-43f4-b8c7-06b29c272bdd/orders/76fb9d52-a3ef-42d3-8b4e-90092f57534c/payments/2fff837f-9a39-4a02-8435-9aaa7cb6b558/saved-card"
          },
          "curies": [
            {
              "name": "cnp",
              "href": "https://api-gateway.sandbox.ngenius-payments.com/docs/rels/{rel}",
              "templated": true
            }
          ]
        },
        "state": "STARTED",
        "amount": {
          "currencyCode": "AED",
          "value": 1000
        },
        "updateDateTime": "2019-04-17T08:15:18.912Z",
        "outletId": "5edab6d7-5946-43f4-b8c7-06b29c272bdd",
        "orderReference": "76fb9d52-a3ef-42d3-8b4e-90092f57534c"
      }
    ]
  }
}
Code example (PHP + cURL):

PHP

$postData = new StdClass();
$postData->action = "PURCHASE";
$postData->amount = new StdClass();
$postData->amount->currencyCode = "AED";
$postData->amount->value = 100;

$outlet = "[your-outlet-reference]";
$token = "[your-access-token]";

$json = json_encode($postData);
$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, "https://api-gateway.sandbox.ngenius-payments.com/transactions/outlets/".$outlet."/orders");
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
"Authorization: Bearer ".$token, 
"Content-Type: application/vnd.ni-payment.v2+json",
"Accept: application/vnd.ni-payment.v2+json"));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, 1);
curl_setopt($ch, CURLOPT_POSTFIELDS, $json);

$output = json_decode(curl_exec($ch));
$order_reference = $output->reference;
$order_paypage_url = $output->_links->payment->href;

curl_close ($ch);
Note: you will require the order_paypage_url (hosted payment page URL) values for the following steps. It may also be beneficial for you to extract and hold the order_reference value.

# Network International Payment Gateway Integration

## Overview
This document outlines the integration of Network International (N-Genius) payment gateway into the Pinewraps application. Network International provides a secure payment processing solution for accepting credit card payments in the UAE.

## Prerequisites
Before implementing the payment gateway, ensure you have the following:

1. Network International Account Credentials:
   - API Key
   - Outlet ID/Reference
   - Access Token
   - API Endpoint URLs

2. Environment URLs:
   - Sandbox (Testing): `https://api-gateway.sandbox.ngenius-payments.com`
   - Production: `https://api-gateway.ngenius-payments.com`

## Implementation Steps

### 1. Environment Configuration
Add the following variables to your `.env` file:
```env
NGENIUS_API_KEY=your_api_key
NGENIUS_OUTLET_ID=your_outlet_id
NGENIUS_API_URL=sandbox_or_production_url
```

### 2. Payment Flow
1. **Order Creation**
   - Create order in our system
   - Initialize payment with Network International
   - Redirect customer to payment page

2. **Payment Processing**
   - Customer enters payment details
   - Network International processes payment
   - Customer redirected back to our site

3. **Payment Verification**
   - Verify payment status
   - Update order status
   - Send confirmation to customer

### 3. API Endpoints

#### Create Payment Order
```typescript
POST /api/payments/create
{
  "orderId": "string",
  "amount": number,
  "currency": "AED",
  "paymentMethod": "CREDIT_CARD"
}
```

#### Payment Callback
```typescript
POST /api/payments/callback
{
  "ref": "string",
  "orderStatus": "string"
}
```

#### Payment Webhook
```typescript
POST /api/payments/webhook
{
  "eventType": "string",
  "payload": {}
}
```

### 4. Payment Statuses
- `PENDING`: Initial payment status
- `AUTHORIZED`: Payment has been authorized
- `CAPTURED`: Payment has been captured
- `FAILED`: Payment failed
- `CANCELLED`: Payment was cancelled
- `REFUNDED`: Payment was refunded

## Security Considerations

1. **API Key Security**
   - Store API keys securely
   - Never expose keys in client-side code
   - Use environment variables

2. **Data Encryption**
   - All communication must be over HTTPS
   - Sensitive data must be encrypted
   - Follow PCI DSS guidelines

3. **Webhook Security**
   - Validate webhook signatures
   - Implement IP whitelisting
   - Use HTTPS for webhooks

## Testing

### Sandbox Testing Cards
- Visa: 4111 1111 1111 1111
- Mastercard: 5105 1051 0510 5100
- Expiry Date: Any future date
- CVV: Any 3 digits

### Test Scenarios
1. Successful Payment
2. Failed Payment
3. Cancelled Payment
4. Refund Flow
5. Invalid Card
6. Expired Card

## Error Handling

1. **Payment Failures**
   - Log detailed error information
   - Show user-friendly error messages
   - Implement retry mechanism

2. **Network Issues**
   - Implement timeout handling
   - Add retry logic
   - Monitor failed requests

3. **Invalid Responses**
   - Validate all API responses
   - Handle unexpected response formats
   - Log validation errors

## Monitoring and Logging

1. **Payment Monitoring**
   - Track success/failure rates
   - Monitor average transaction time
   - Alert on high failure rates

2. **Transaction Logging**
   - Log all payment attempts
   - Store request/response data
   - Maintain audit trail

## Refund Process

1. **Full Refund**
   - Refund entire payment amount
   - Update order status
   - Send refund confirmation

2. **Partial Refund**
   - Refund specific amount
   - Track refund history
   - Update order balance

## Integration Checklist

- [ ] Set up Network International account
- [ ] Configure environment variables
- [ ] Implement payment creation
- [ ] Set up webhook endpoints
- [ ] Implement payment verification
- [ ] Add error handling
- [ ] Test with sandbox credentials
- [ ] Implement refund functionality
- [ ] Set up monitoring
- [ ] Document API responses
- [ ] Perform security audit
- [ ] Test all payment scenarios