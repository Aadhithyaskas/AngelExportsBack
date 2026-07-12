# Tamil Authentic Foods — Backend (MERN)

Express + MongoDB backend for an owner-managed e-commerce app with public customer catalog pages.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in real values (Mongo URI, JWT secret, email creds)
npm run seed:owner      # creates the one-time owner account with a dummy password
npm run dev              # starts server with nodemon (or `npm start` for plain node)
```

## Auth flow

1. **Owner account**: created once via `npm run seed:owner`, using `OWNER_EMAIL` /
   `OWNER_DUMMY_PASSWORD` from `.env`, with `isFirstLogin: true`.
2. **Login** (`POST /api/auth/login`): if `isFirstLogin` is true, the API does **not**
   issue a full JWT. It returns `{ firstLogin: true, tempToken }`. The frontend should
   redirect to a "Set new password" screen and send `tempToken` as the Bearer token.
3. **Set password** (`POST /api/auth/set-password`, header `Authorization: Bearer <tempToken>`):
   sets the new password, flips `isFirstLogin` to false, and returns a normal full JWT.
4. **Subsequent logins**: `isFirstLogin` is false, so `/api/auth/login` returns a full JWT directly.
5. **Forgot password** (`POST /api/auth/forgot-password`): emails a reset link
   (`CLIENT_URL/reset-password/:token`).
6. **Reset password** (`POST /api/auth/reset-password/:token`): sets a new password using the
   emailed token.

## Roles

- `owner`: can create/update/delete categories and products.
- Customers do not need accounts. Public webpages can view categories and view/filter
  products by category, price, and search text.

`middleware/roleMiddleware.js` (`authorize("owner")`) enforces this on top of
`middleware/authMiddleware.js` (`protect`), which verifies the JWT.

## Key endpoints

| Method | Route | Access | Purpose |
|---|---|---|---|
| POST | /api/auth/login | Public | Login (owner only) |
| POST | /api/auth/set-password | Temp token | First-login password change |
| POST | /api/auth/forgot-password | Public | Request reset email |
| POST | /api/auth/reset-password/:token | Public | Reset password |
| GET | /api/auth/me | Private | Current user profile |
| GET | /api/categories | Public | List categories |
| POST | /api/categories | Owner | Create category |
| PUT | /api/categories/:id | Owner | Update category |
| DELETE | /api/categories/:id | Owner | Delete category (blocked if products exist) |
| GET | /api/products?category=&search=&minPrice=&maxPrice= | Public | List/filter products |
| GET | /api/products/category/:categoryId | Public | Products in a category |
| POST | /api/products | Owner | Create product |
| PUT | /api/products/:id | Owner | Update product |
| DELETE | /api/products/:id | Owner | Delete product |

## Notes / next steps

- `photo` on Product and `image` on Category currently store a URL string — wire up
  Cloudinary/S3/multer upload in the frontend or add an `/api/upload` route if you want
  direct file uploads instead of pasted URLs.
- All list responses are ready to be consumed by a React frontend using `axios`/`fetch`
  with the JWT stored (e.g. in memory + httpOnly cookie or localStorage) and sent as
  `Authorization: Bearer <token>`.
