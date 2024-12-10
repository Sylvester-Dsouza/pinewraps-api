# Pinewraps API Documentation

This document provides a comprehensive list of all available endpoints in the Pinewraps API.

## Table of Contents
- [Admin Authentication](#admin-authentication)
- [Products](#products)
- [Orders](#orders)
- [Coupons](#coupons)
- [Customers](#customers)
- [Customer Authentication](#customer-authentication)
- [Rewards](#rewards)
- [Users](#users)
- [Admin](#admin)
- [Categories](#categories)
- [Health Check](#health-check)

## Admin Authentication
Base path: `/admin-auth`

### Public Endpoints

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| POST | `/login` | Admin login | `{ "email": "string", "password": "string" }` |

### Protected Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/me` | Get current admin info | Requires Authentication |

All protected endpoints require an authentication token in the Authorization header:
```
Authorization: Bearer your-token-here
```

### Responses

#### Login Success Response
```json
{
  "success": true,
  "data": {
    "token": "firebase-custom-token",
    "user": {
      "id": "user-id",
      "email": "admin@example.com",
      "name": "Admin Name",
      "role": "SUPER_ADMIN",
      "access": ["list", "of", "permissions"]
    }
  }
}
```

#### Get Admin Info Response
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id",
      "email": "admin@example.com",
      "name": "Admin Name",
      "role": "SUPER_ADMIN",
      "access": ["list", "of", "permissions"]
    }
  }
}
```

## Products
Base path: `/products`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/public` | Get all public products | Public |
| GET | `/public/:id` | Get specific public product | Public |
| GET | `/` | Get all products | Protected |
| GET | `/analytics` | Get product analytics | Protected |
| GET | `/:id` | Get specific product | Protected |
| POST | `/` | Create new product | Protected |
| POST | `/:id/media` | Upload product images | Protected |
| PUT | `/:id` | Update product | Protected |
| PATCH | `/:id` | Partial update product | Protected |
| DELETE | `/:id` | Delete product | Protected |

## Orders
Base path: `/orders`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/analytics` | Get order analytics | Admin |
| GET | `/export` | Export orders | Admin |
| POST | `/` | Create new order | Authenticated |
| GET | `/` | Get user orders | Authenticated |
| GET | `/:orderId` | Get specific order | Authenticated |
| PUT | `/:orderId/status` | Update order status | Admin |
| DELETE | `/:orderId` | Cancel order | Admin |

## Coupons
Base path: `/coupons`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/` | Get all coupons | Protected |
| POST | `/` | Create coupon | Protected |
| GET | `/:id` | Get specific coupon | Protected |
| PUT | `/:id` | Update coupon | Protected |
| DELETE | `/:id` | Delete coupon | Protected |
| POST | `/:code/validate` | Validate coupon code | Public |

## Customers
Base path: `/customers`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/me` | Get current customer info | Authenticated |
| GET | `/profile` | Get customer profile | Authenticated |
| GET | `/addresses` | Get customer addresses | Authenticated |
| POST | `/addresses` | Create address | Authenticated |
| PUT | `/addresses/:id` | Update address | Authenticated |
| DELETE | `/addresses/:id` | Delete address | Authenticated |
| POST | `/request-reset` | Request password reset | Public |
| POST | `/reset-password` | Reset password | Public |
| GET | `/` | Get all customers | Admin |
| GET | `/:id` | Get specific customer | Admin |
| DELETE | `/:id` | Delete customer | Admin |

## Customer Authentication
Base path: `/auth`

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register a new customer |
| POST | `/login` | Login customer |
| POST | `/social` | Google/Social Sign-In |

### Protected Endpoints

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/me` | Get current customer info | Requires Authentication |

## Rewards
Base path: `/rewards`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/` | Get user rewards | Authenticated |
| POST | `/redeem` | Redeem points | Authenticated |
| GET | `/:customerId` | Get customer rewards | Admin |
| POST | `/:customerId/add` | Add points to customer | Admin |
| GET | `/analytics` | Get rewards analytics | Admin |

## Users
Base path: `/users`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/profile` | Get user profile | Authenticated |
| PUT | `/profile` | Update user profile | Authenticated |
| GET | `/addresses` | Get user addresses | Authenticated |
| POST | `/addresses` | Add user address | Authenticated |
| PUT | `/addresses/:id` | Update user address | Authenticated |
| DELETE | `/addresses/:id` | Delete user address | Authenticated |
| PUT | `/notifications` | Update notification preferences | Authenticated |
| POST | `/verify` | Verify user token | Authenticated |
| GET | `/:userId` | Get specific user | Super Admin |
| DELETE | `/:userId` | Delete user | Super Admin |
| POST | `/:userId/make-admin` | Make user an admin | Super Admin |

## Admin
Base path: `/admins`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/profile` | Get admin profile | Admin |
| POST | `/users` | Create admin user | Super Admin |
| GET | `/me` | Get current admin's profile and access | Admin |
| PUT | `/users/:id` | Update admin user | Super Admin |
| PUT | `/users/:id/access` | Update admin access | Super Admin |

## Categories
Base path: `/categories`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/` | Get all categories | Protected |
| GET | `/:id` | Get specific category | Protected |
| POST | `/` | Create category | Protected |

## Health Check
Base path: `/`

| Method | Endpoint | Description | Access |
|--------|----------|-------------|---------|
| GET | `/health` | API health check endpoint | Public |

## Access Levels
- **Public**: No authentication required
- **Protected**: Requires authentication token
- **Authenticated**: Requires valid user authentication
- **Admin**: Requires admin privileges
- **Super Admin**: Requires super admin privileges