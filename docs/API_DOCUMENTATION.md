# Pinewraps API Documentation

## Overview
This documentation provides comprehensive details about the Pinewraps API endpoints, including authentication, request/response formats, and examples.

## Base URL
```
http://localhost:3001/api
```

## Authentication
All protected endpoints require a valid Firebase ID token in the Authorization header:
```
Authorization: Bearer [Firebase ID Token]
```


## Common Response Formats

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  }
}
```

## Common Error Codes

- `UNAUTHORIZED`: Authentication token is missing or invalid
- `FORBIDDEN`: Insufficient permissions to perform the action
- `NOT_FOUND`: Requested resource not found
- `VALIDATION_ERROR`: Invalid request parameters
- `INTERNAL_ERROR`: Internal server error

## Rate Limiting
- Rate limit: 100 requests per minute per IP
- Rate limit headers included in response:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Testing
Each API module includes its own test status section indicating which endpoints have been tested and verified.


## Error Responses
Common error responses for all endpoints:
- 401: Unauthorized - Missing or invalid Firebase ID token
- 403: Forbidden - Valid token but insufficient permissions
- 500: Internal Server Error

## Authentication Endpoints

### Admin Authentication

#### 1. Initialize Super Admin
- **Endpoint**: `POST /admin-auth/initialize`
- **Description**: Creates the initial super admin user (only works if no super admin exists)
- **Request Body**:
  ```json
  {
    "email": "admin@example.com",
    "password": "password",
    "name": "Super Admin"
  }
  ```
- **Test Results**:
  ```bash
  curl -X POST http://localhost:3001/api/admin-auth/initialize \
    -H "Content-Type: application/json" \
    -d '{"email":"superadmin@pinewraps.com","password":"Admin123!","name":"Super Admin"}'
  ```
  Response: `{"error":"Super admin already exists"}`
  
  Note: Super admin already exists with email: admin@pinewraps.com

#### 2. Admin Login
- **Endpoint**: `POST /admin-auth/login`
- **Description**: Authenticates an admin user and returns a Firebase ID token
- **Request Body**:
  ```json
  {
    "email": "admin@example.com",
    "password": "password"
  }
  ```
- **Test Results**:
  ```bash
  curl -X POST http://localhost:3001/api/admin-auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@pinewraps.com","password":"Admin123!"}'
  ```
  Response: Success with Firebase ID token


## Admin Endpoints

### Profile Management

#### 1. Get Admin Profile
- **Endpoint**: `GET /admins/profile`
- **Description**: Get current admin's profile
- **Headers**: `Authorization: Bearer [Firebase ID Token]`
- **Response Example**:
  ```json
  {
    "success": true,
    "data": {
      "id": "OYjPqFGLXWamCdQplDET44RkgPH2",
      "email": "admin@pinewraps.com",
      "name": null,
      "role": "SUPER_ADMIN",
      "adminAccess": [],
      "isActive": true,
      "createdAt": "2024-12-01T09:06:07.326Z",
      "updatedAt": "2024-12-01T09:06:07.326Z"
    }
  }
  ```
- **Status**: ✅ Tested and working

### Admin Management

#### Create Admin User
- **Endpoint**: `POST /admins/users`
- **Method**: `POST`
- **Auth Required**: Yes (Super Admin token required)
- **Description**: Creates a new admin user with basic admin privileges.

**Request Body**:
```json
{
  "email": "admin@example.com",
  "password": "securepassword",
  "name": "Admin Name"
}
```

**Response Example**:
```json
{
  "success": true,
  "data": {
    "id": "9dc9bd21-553c-4bb2-8c5c-e3d54e28f746",
    "email": "admin@example.com",
    "name": "Admin Name",
    "role": "ADMIN",
    "isActive": true,
    "createdAt": "2024-12-03T15:02:26.691Z",
    "updatedAt": "2024-12-03T15:02:26.691Z",
    "firebaseUid": "azWyrNMqrqRfOW4orq9d2MrE9oX2"
  }
}
```

**Status**: ✅ Tested and working

#### List Admin Users
- **URL**: `/api/admins/users`
- **Method**: `GET`
- **Auth Required**: Yes (Super Admin token required)
- **Description**: Retrieves a list of all admin users.

**Response Example**:
```json
{
  "success": true,
  "data": [
    {
      "id": "9dc9bd21-553c-4bb2-8c5c-e3d54e28f746",
      "email": "admin2@pinewraps.com",
      "name": "Test Admin",
      "adminAccess": [],
      "isActive": true,
      "createdAt": "2024-12-03T15:02:26.691Z",
      "updatedAt": "2024-12-03T15:02:26.691Z",
      "firebaseUid": "azWyrNMqrqRfOW4orq9d2MrE9oX2"
    }
  ]
}
```

**Status**: ✅ Tested and working

#### Get Admin User
- **URL**: `/api/admins/users/:id`
- **Method**: `GET`
- **Auth Required**: Yes (Super Admin token required)
- **Description**: Retrieves details of a specific admin user by their Firebase UID.

**Response Example**:
```json
{
  "success": true,
  "data": {
    "id": "9dc9bd21-553c-4bb2-8c5c-e3d54e28f746",
    "email": "admin2@pinewraps.com",
    "name": "Test Admin",
    "adminAccess": [],
    "isActive": true,
    "createdAt": "2024-12-03T15:02:26.691Z",
    "updatedAt": "2024-12-03T15:02:26.691Z",
    "firebaseUid": "azWyrNMqrqRfOW4orq9d2MrE9oX2"
  }
}
```

**Status**: ✅ Tested and working

#### Update Admin User
- **URL**: `/api/admins/users/:id`
- **Method**: `PUT`
- **Auth Required**: Yes (Super Admin token required)
- **Description**: Updates details of a specific admin user.

**Request Body**:
```json
{
  "name": "Updated Admin Name"
}
```

**Response Example**:
```json
{
  "success": true,
  "data": {
    "id": "9dc9bd21-553c-4bb2-8c5c-e3d54e28f746",
    "email": "admin2@pinewraps.com",
    "name": "Updated Admin Name",
    "adminAccess": [],
    "isActive": true,
    "createdAt": "2024-12-03T15:02:26.691Z",
    "updatedAt": "2024-12-03T15:05:50.523Z",
    "firebaseUid": "azWyrNMqrqRfOW4orq9d2MrE9oX2"
  }
}
```

**Status**: ✅ Tested and working

#### Deactivate Admin User
- **Endpoint**: `PUT /api/admins/users/:id/deactivate`
- **Authentication**: Required (Super Admin only)
- **Description**: Deactivates an admin user by their Firebase UID. This will disable both their database account and Firebase authentication.

**Path Parameters:**
- `id`: Firebase UID of the admin user to deactivate

**Response Example:**
```json
{
  "success": true,
  "data": {
    "id": "9dc9bd21-553c-4bb2-8c5c-e3d54e28f746",
    "email": "admin2@pinewraps.com",
    "name": "Updated Admin Name",
    "role": "ADMIN",
    "adminAccess": [],
    "isActive": false,
    "createdAt": "2024-12-03T15:02:26.691Z",
    "updatedAt": "2024-12-03T15:09:29.599Z",
    "firebaseUid": "azWyrNMqrqRfOW4orq9d2MrE9oX2"
  }
}
```

**Error Responses:**
- 404: Admin user not found
- 500: Error deactivating admin user

**Test Status:** ✅ Tested and working

### Order Analytics

#### Get Order Analytics
- **Endpoint**: `GET /api/admins/orders/analytics`
- **Authentication**: Required (Admin only)
- **Description**: Retrieves analytics data about orders including totals and monthly growth

**Response Example:**
```json
{
  "success": true,
  "data": {
    "totalOrders": 16,
    "totalRevenue": 0,
    "pendingOrders": 0,
    "processingOrders": 16,
    "completedOrders": 0,
    "monthlyGrowth": 100
  }
}
```

**Test Status:** ✅ Tested and working

### Customer Management

#### 1. List Customers
- **Endpoint**: `GET /admin/customers`
- **Description**: Get list of all customers
- **Headers**: `Authorization: Bearer [Firebase ID Token]`
- **Query Parameters**:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
  - `search`: Search term for name/email

#### 2. Get Customer Details
- **Endpoint**: `GET /admin/customers/:id`
- **Description**: Get detailed information about a specific customer
- **Headers**: `Authorization: Bearer [Firebase ID Token]`

#### 3. Update Customer
- **Endpoint**: `PUT /admin/customers/:id`
- **Description**: Update customer information
- **Headers**: `Authorization: Bearer [Firebase ID Token]`
- **Request Body**: Customer data to update

#### 4. Delete Customer
- **Endpoint**: `DELETE /admin/customers/:id`
- **Description**: Delete a customer account
- **Headers**: `Authorization: Bearer [Firebase ID Token]`

### Order Management

#### 1. List Orders
- **Endpoint**: `GET /admin/orders`
- **Description**: Get list of all orders
- **Headers**: `Authorization: Bearer [Firebase ID Token]`
- **Query Parameters**:
  - `page`: Page number
  - `limit`: Items per page
  - `status`: Order status filter

#### 2. Get Order Details
- **Endpoint**: `GET /admin/orders/:id`
- **Description**: Get detailed information about a specific order
- **Headers**: `Authorization: Bearer [Firebase ID Token]`

#### 3. Update Order Status
- **Endpoint**: `PUT /admin/orders/:id/status`
- **Description**: Update order status
- **Headers**: `Authorization: Bearer [Firebase ID Token]`
- **Request Body**:
  ```json
  {
    "status": "PROCESSING | SHIPPED | DELIVERED | CANCELLED"
  }
  ```

### Reward Management

#### 1. List Rewards
- **Endpoint**: `GET /admin/rewards`
- **Description**: Get list of all reward transactions
- **Headers**: `Authorization: Bearer [Firebase ID Token]`

#### 2. Add Reward Points
- **Endpoint**: `POST /admin/rewards/add`
- **Description**: Add reward points to a customer
- **Headers**: `Authorization: Bearer [Firebase ID Token]`
- **Request Body**:
  ```json
  {
    "customerId": "customer_id",
    "points": 100,
    "reason": "Purchase reward"
  }
  ```

### Product Management

#### 1. List Public Products
- **Endpoint**: `GET /api/products/public`
- **Authentication**: Not Required
- **Description**: Retrieves a list of all active products visible to the public
- **Response Example**:
```json
{
  "success": true,
  "data": [
    {
      "id": "c852e6b3120b65c5",
      "name": "Product Name",
      "description": "Product Description",
      "sku": "SKU123",
      "status": "ACTIVE",
      "basePrice": 32,
      "category": {
        "id": "CAT_COMBOS",
        "name": "Combos"
      },
      "images": [
        {
          "id": "a513bb088420de31",
          "url": "https://example.com/image.jpg",
          "alt": "Product Image",
          "isPrimary": false
        }
      ],
      "variations": [
        {
          "type": "SIZE",
          "options": [
            {
              "value": "Small",
              "priceAdjustment": 0,
              "stock": 0
            }
          ]
        }
      ]
    }
  ]
}
```

#### 2. Get Product Analytics
- **Endpoint**: `GET /api/products/analytics`
- **Authentication**: Required (Admin)
- **Description**: Retrieves analytics data about products
- **Response Example**:
```json
{
  "success": true,
  "data": {
    "totalProducts": 2,
    "activeProducts": 2,
    "draftProducts": 0,
    "totalCategories": 3
  }
}
```

#### 3. Create Product
- **Endpoint**: `POST /api/products`
- **Authentication**: Required (Admin)
- **Description**: Creates a new product
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  - `name` (string, required): Product name
  - `description` (string): Product description
  - `basePrice` (number, required): Base price of the product
  - `category` (string, required): Product category ID
  - `variations` (JSON string): Array of product variations
  - `specifications` (JSON string): Product specifications
  - `tags` (JSON string): Array of product tags
  - `images` (files, optional): Product images (max 5 files, 5MB each)

#### 4. Upload Product Images
- **Endpoint**: `POST /api/products/:id/media`
- **Authentication**: Required (Admin)
- **Description**: Uploads images for an existing product
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  - `images` (files): Product images (max 5 files, 5MB each)

#### 5. Update Product
- **Endpoint**: `PUT /api/products/:id`
- **Authentication**: Required (Admin)
- **Description**: Updates an existing product
- **Content-Type**: `multipart/form-data`
- **Request Body**: Same as Create Product endpoint

#### 6. Get Product by ID
- **Endpoint**: `GET /api/products/:id`
- **Authentication**: Required (Admin)
- **Description**: Retrieves details of a specific product

#### 7. Get Public Product by ID
- **Endpoint**: `GET /api/products/public/:id`
- **Authentication**: Not Required
- **Description**: Retrieves public details of a specific product

## Customer Authentication Endpoints

### Email/Password Authentication

#### 1. Customer Login
- **Endpoint**: `POST /api/customers/auth/login`
- **Description**: Authenticates a customer using Firebase ID token and returns customer data
- **Headers**: `Authorization: Bearer [Firebase ID Token]`
- **Request Body**:
  ```json
  {
    "email": "customer@example.com"
  }
  ```
- **Response Example**:
  ```json
  {
    "success": true,
    "data": {
      "token": "[Firebase ID Token]",
      "customer": {
        "id": "123",
        "email": "customer@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "phone": "+1234567890",
        "isEmailVerified": true,
        "reward": {
          "points": 0,
          "totalPoints": 0
        }
      }
    }
  }
  ```
- **Error Responses**:
  - 401: Invalid or missing Firebase token
  - 404: Customer not found
  - 500: Server error
- **Notes**: 
  - The client must first authenticate with Firebase to get the ID token
  - The token's email must match the email in the request body
- **Status**: ✅ Tested and working

#### 2. Customer Registration
- **Endpoint**: `POST /api/customers/auth/register`
- **Description**: Creates a new customer account using Firebase ID token
- **Headers**: `Authorization: Bearer [Firebase ID Token]`
- **Request Body**:
  ```json
  {
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890"
  }
  ```
- **Response Example**:
  ```json
  {
    "success": true,
    "data": {
      "token": "[Firebase ID Token]",
      "customer": {
        "id": "123",
        "email": "customer@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "phone": "+1234567890",
        "isEmailVerified": false,
        "reward": {
          "points": 0,
          "totalPoints": 0
        }
      }
    }
  }
  ```
- **Error Responses**:
  - 400: Email already registered or invalid data
  - 401: Invalid or missing Firebase token
  - 500: Server error
- **Notes**:
  - A reward account is automatically created for new customers
  - Custom claims are set on the Firebase user for customer role
  - `lastName` is optional
- **Status**: ✅ Tested and working

#### 3. Get Customer Profile
- **Endpoint**: `GET /api/customers/auth/me`
- **Description**: Retrieves the current customer's profile data
- **Headers**: `Authorization: Bearer [Firebase ID Token]`
- **Response Example**:
  ```json
  {
    "success": true,
    "data": {
      "customer": {
        "id": "123",
        "email": "customer@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "phone": "+1234567890",
        "isEmailVerified": true,
        "reward": {
          "points": 0,
          "totalPoints": 0
        }
      }
    }
  }
  ```
- **Error Responses**:
  - 401: Invalid or missing Firebase token
  - 404: Customer not found
  - 500: Server error
- **Status**: ✅ Tested and working

#### 4. Update Customer Profile
- **Endpoint**: `PUT /api/customers/auth/profile`
- **Description**: Updates the current customer's profile information
- **Headers**: `Authorization: Bearer [Firebase ID Token]`
- **Request Body**:
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890"
  }
  ```
- **Response Example**:
  ```json
  {
    "success": true,
    "data": {
      "customer": {
        "id": "123",
        "email": "customer@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "phone": "+1234567890",
        "isEmailVerified": true,
        "reward": {
          "points": 0,
          "totalPoints": 0
        }
      }
    }
  }
  ```
- **Error Responses**:
  - 400: Invalid data format
  - 401: Invalid or missing Firebase token
  - 404: Customer not found
  - 500: Server error
- **Notes**:
  - All fields in request body are optional. Only provided fields will be updated
  - Email cannot be updated through this endpoint
  - Firebase token must belong to the customer being updated
- **Status**: ✅ Tested and working

### Social Authentication

#### 1. Social Login/Register
- **Endpoint**: `POST /api/customers/auth/social`
- **Description**: Handles login/registration via social providers (Google)
- **Headers**: `Authorization: Bearer [Firebase ID Token]`
- **Request Body**:
  ```json
  {
    "token": "[Firebase ID Token]",
    "provider": "GOOGLE"
  }
  ```
- **Response Example**: Same as email/password login
- **Notes**:
  - Automatically creates customer account if it doesn't exist
  - Uses provider profile data for customer details
- **Status**: ✅ Tested and working

## API Testing Checklist & Results

### 1. Admin Authentication and Management
- [x] POST /admin-auth/login
  - Status: ✅ TESTED
  - Result: Successfully logged in with admin credentials
  - Test Date: 2024-01-03

- [x] GET /admins/profile
  - Status: ✅ TESTED
  - Result: Successfully retrieved admin profile
  - Test Date: 2024-01-03

- [x] POST /admins/users
  - Status: ✅ TESTED
  - Result: Successfully created new admin user
  - Test Date: 2024-01-03

- [x] GET /admins/users
  - Status: ✅ TESTED
  - Result: Successfully retrieved list of admin users
  - Test Date: 2024-01-03

- [x] GET /admins/users/:id
  - Status: ✅ TESTED
  - Result: Successfully retrieved specific admin user
  - Test Date: 2024-01-03

- [x] PUT /admins/users/:id
  - Status: ✅ TESTED
  - Result: Successfully updated admin user details
  - Test Date: 2024-01-03

- [x] PUT /admins/users/:id/deactivate
  - Status: ✅ TESTED
  - Result: Successfully deactivated admin user
  - Test Date: 2024-01-03

- [x] GET /admins/orders/analytics
  - Status: ✅ TESTED
  - Result: Successfully retrieved order analytics
  - Test Date: 2024-01-03

### 2. Customer Authentication
- [x] POST /api/customers/auth/register
  - Status: ✅ TESTED
  - Result: Successfully registered new customer
  - Test Date: 2024-01-03

- [x] POST /customer-auth/login
  - Status: ✅ TESTED
  - Result: Successfully logged in with customer credentials
  - Test Date: 2024-01-03

- [x] POST /customer-auth/social
  - Status: ✅ TESTED
  - Result: Successfully logged in with social provider
  - Test Date: 2024-01-03

- [x] GET /customer-auth/me
  - Status: ✅ TESTED
  - Result: Successfully retrieved customer profile
  - Test Date: 2024-01-03

### 3. Customer Management (Admin)
- [ ] GET /admin/customers
  - Status: 🔄 NOT TESTED
  - Dependencies: Admin authentication

- [ ] GET /admin/customers/:id
  - Status: 🔄 NOT TESTED
  - Dependencies: Admin authentication, Customer data

- [ ] PUT /admin/customers/:id
  - Status: 🔄 NOT TESTED
  - Dependencies: Admin authentication, Customer data

- [ ] DELETE /admin/customers/:id
  - Status: 🔄 NOT TESTED
  - Dependencies: Admin authentication, Customer data

### 4. Order Management
- [ ] GET /admin/orders
  - Status: 🔄 NOT TESTED
  - Dependencies: Admin authentication, Order data

- [ ] GET /admin/orders/:id
  - Status: 🔄 NOT TESTED
  - Dependencies: Admin authentication, Order data

- [ ] PUT /admin/orders/:id/status
  - Status: 🔄 NOT TESTED
  - Dependencies: Admin authentication, Order data

### 5. Reward Management
- [ ] GET /admin/rewards
  - Status: 🔄 NOT TESTED
  - Dependencies: Admin authentication, Reward data

- [ ] POST /admin/rewards/add
  - Status: 🔄 NOT TESTED
  - Dependencies: Admin authentication, Customer data

### 6. Product Management
- [x] GET /products/public
  - Status: ✅ TESTED
  - Result: Successfully retrieved public products list
  - Test Date: 2024-01-03

- [x] GET /products/analytics
  - Status: ✅ TESTED
  - Result: Successfully retrieved product analytics
  - Test Date: 2024-01-03

- [x] POST /products
  - Status: ✅ TESTED
  - Result: Product creation endpoint working with form data
  - Test Date: 2024-01-03

- [x] POST /products/:id/media
  - Status: ✅ TESTED
  - Result: Image upload functionality working
  - Test Date: 2024-01-03

- [x] PUT /products/:id
  - Status: ✅ TESTED
  - Result: Product update functionality working
  - Test Date: 2024-01-03

- [x] GET /products/:id
  - Status: ✅ TESTED
  - Result: Successfully retrieved specific product details
  - Test Date: 2024-01-03

- [x] GET /products/public/:id
  - Status: ✅ TESTED
  - Result: Successfully retrieved public product details
  - Test Date: 2024-01-03

## Legend
- ✅ TESTED (Passed)
- ❌ FAILED (Need fixes)
- 🔄 NOT TESTED
- ⚠️ PARTIALLY TESTED

## Next Steps
1. Implement missing admin profile endpoint
2. Add error handling for invalid tokens
3. Test customer authentication flow
4. Test customer management endpoints
5. Test order management endpoints
6. Test reward management endpoints

## Issues Found
1. Admin profile endpoint (/api/admin/profile) is not implemented
2. Need to verify token expiration handling
3. Need to implement proper error responses for invalid/expired tokens

## Testing Progress

1. ✅ Admin Authentication and Management
   - ✅ Super admin initialization (verified existing)
   - ✅ Admin login (successfully tested)
   - ✅ Get admin profile (successfully tested)
   - ✅ Create admin user (successfully tested)
   - ✅ List admin users (successfully tested)
   - ✅ Get specific admin user (successfully tested)
   - ✅ Update admin user (successfully tested)
   - ✅ Deactivate admin user (successfully tested)
   - ✅ Get order analytics (successfully tested)

2. ✅ Customer Authentication
   - ✅ Customer registration (successfully tested)
   - ✅ Customer login (successfully tested)
   - ✅ Social login (successfully tested)
   - ✅ Get customer profile (successfully tested)

3. 🔄 Customer Management
   - Not tested yet

4. 🔄 Order Management
   - Not tested yet

5. 🔄 Reward Management
   - Not tested yet

6. ✅ Product Management
   - ✅ List public products (successfully tested)
   - ✅ Get product analytics (successfully tested)
   - ✅ Create product (successfully tested)
   - ✅ Upload product images (successfully tested)
   - ✅ Update product (successfully tested)
   - ✅ Get product by ID (successfully tested)
   - ✅ Get public product by ID (successfully tested)

## Notes

- All protected endpoints require a valid Firebase ID token in the Authorization header
- Error responses follow the format: `{"error": "Error message"}`
- Success responses follow the format: `{"success": true, "data": {...}}`

### Customer Authentication

#### 1. Customer Registration
- **Endpoint**: `POST /api/customers/auth/register`
- **Description**: Registers a new customer account
- **Authentication**: Requires Firebase ID token from frontend registration
- **Request Headers**:
  ```
  Authorization: Bearer [Firebase ID Token]
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "email": "customer@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+971501234567"
  }
  ```
- **Success Response** (201 Created):
  ```json
  {
    "success": true,
    "data": {
      "token": "[Firebase Token]",
      "customer": {
        "id": "uuid",
        "email": "customer@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "isEmailVerified": false,
        "reward": {
          "id": "uuid",
          "points": 0,
          "totalPoints": 0
        }
      }
    }
  }
  ```
- **Error Responses**:
  - 400: Missing required fields or invalid data
    ```json
    {
      "success": false,
      "error": {
        "message": "Missing required fields"
      }
    }
    ```
  - 400: Email already registered
    ```json
    {
      "success": false,
      "error": {
        "message": "Email already registered"
      }
    }
    ```
  - 401: No token provided or invalid token
    ```json
    {
      "success": false,
      "error": {
        "message": "No token provided"
      }
    }
    ```
- **Notes**:
  - The frontend must first create a Firebase user account and obtain an ID token
  - The backend will verify the token and create the customer record
  - A reward account is automatically created for new customers
  - Custom claims are set on the Firebase user for customer role
  - `lastName` is optional
- **Status**: ✅ Tested and working

#### 2. Customer Login
- **Endpoint**: `POST /customer-auth/login`
- **Description**: Authenticates a customer user and returns a Firebase ID token
- **Request Body**:
  ```json
  {
    "email": "customer@example.com",
    "password": "password"
  }
  ```
- **Test Results**:
  ```bash
  curl -X POST http://localhost:3001/api/customer-auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"customer@pinewraps.com","password":"Customer123!"}'
  ```
  Response: Success with Firebase ID token
