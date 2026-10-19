# Fyinder HRMS — Frontend

A React + Vite frontend for the **Fyinder HRMS** (Human Resource Management System) platform. Provides an end-to-end UI for managing employees, head offices, projects, leaves, payroll, attendance, contracts, invoices, RBAC roles & permissions, staffing companies, and account settings — backed by the Fyinder HRMS REST API.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Prerequisites](#prerequisites)
3. [Setup](#setup)
4. [Environment Variables](#environment-variables)
5. [Available Scripts](#available-scripts)
6. [Folder Structure](#folder-structure)
7. [Architecture](#architecture)
8. [State Management (Redux Toolkit)](#state-management-redux-toolkit)
9. [API Layer](#api-layer)
10. [Authentication & Authorization](#authentication--authorization)
11. [RBAC (Roles & Permissions)](#rbac-roles--permissions)
12. [Routing](#routing)
13. [File Uploads](#file-uploads)
14. [Forms & Validation](#forms--validation)
15. [Notifications](#notifications)
16. [Styling Conventions](#styling-conventions)
17. [Maps / Geolocation](#maps--geolocation)
18. [Feature Modules](#feature-modules)
19. [Components Reference](#components-reference)
20. [Backend API Reference](#backend-api-reference)
21. [Known Gaps / TODOs](#known-gaps--todos)
22. [Conventions for New Features](#conventions-for-new-features)

---

## Tech Stack

| Layer | Library / Tool | Version |
|---|---|---|
| Build tool | **Vite** | ^8.0.12 |
| UI framework | **React** | ^19.2.6 |
| Routing | **react-router-dom** | ^7.15.1 |
| State management | **@reduxjs/toolkit** + **react-redux** | ^2.12.0 / ^9.3.0 |
| HTTP client | **axios** | ^1.16.1 |
| Forms | **react-hook-form** | ^7.76.0 |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) | ^4.3.0 |
| Icons | **react-icons** | ^5.6.0 |
| Charts | **recharts** | ^3.8.1 |
| Maps | **leaflet** + **react-leaflet** | ^1.9.4 / ^5.0.0 |
| Toasts | **react-toastify** (primary) | ^11.1.0 |
| Lint | **ESLint** (flat config) | ^10.3.0 |

---

## Prerequisites

- **Node.js** v18 or higher (Vite 8 requires modern Node)
- **npm** (or pnpm/yarn — examples use npm)
- A running instance of the Fyinder HRMS backend reachable via the URL set in `VITE_BASE_URL`

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your .env (copy the template below)
cp .env.example .env   # or create manually

# 3. Run the dev server
npm run dev
```

The dev server starts on Vite's default port (usually `http://localhost:5173`). Open it in a browser.

---

## Environment Variables

All client-exposed env vars must be prefixed with `VITE_` (Vite convention).

| Variable | Required | Example | Used by |
|---|---|---|---|
| `VITE_BASE_URL` | Yes | `http://localhost:3001/hrms/v1` | `src/services/api.js` axios baseURL |
| `VITE_LOCATIONIQ_API_KEY` | Optional | `pk.xxxxxxxxxxxxxxxxxxxx` | `src/components/LocationPickerModal.jsx` reverse geocoding |

> Do **not** include a trailing slash on `VITE_BASE_URL` — endpoint constants already start with `/`.

---

## Available Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts Vite dev server with HMR |
| `npm run build` | Type-checks (if applicable) and produces a production build in `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run lint` | Runs ESLint over all `.js` / `.jsx` files |

---

## Folder Structure

```
fyinder_hrms/
├── .env                         # local env vars (gitignored)
├── eslint.config.js             # flat ESLint config
├── index.html                   # Vite HTML entry
├── package.json
├── vite.config.js               # registers React + Tailwind plugins
└── src/
    ├── App.jsx                  # mounts AppRoutes + global toast container
    ├── main.jsx                 # Redux Provider + BrowserRouter bootstrap
    ├── index.css                # Tailwind v4 imports + global styles
    │
    ├── constants/
    │   └── api.js               # single source of truth for all API endpoint paths
    │
    ├── services/                # axios calls grouped per domain
    │   ├── api.js               # configured axios instance + Bearer token interceptor
    │   ├── auth.services.js     # login / signup
    │   ├── employee.services.js # employee CRUD + uploadFileApi
    │   ├── office.services.js   # head office CRUD
    │   └── project.services.js  # project CRUD
    │
    ├── redux/
    │   ├── store.js             # configureStore({ auth, office, project, employee })
    │   └── slice/
    │       ├── auth.slice.js
    │       ├── employee.slice.js
    │       ├── office.slice.js
    │       └── project.slice.js
    │
    ├── routes/
    │   ├── AppRoutes.jsx        # all <Route> definitions
    │   └── PrivateRoutes.jsx    # auth guard wrapper (currently commented out per route)
    │
    ├── layouts/
    │   └── MainLayout.jsx       # Sidebar + Header + scrollable <main> wrapper
    │
    ├── components/              # cross-cutting / shared components
    │   ├── Sidebar.jsx
    │   ├── Header.jsx           # global search, notifications, profile dropdown
    │   ├── AuthLeft.jsx         # left-side branding pane on auth pages
    │   ├── ProfileDropdown.jsx
    │   ├── NotificationPanel.jsx
    │   ├── NotificationSettings.jsx
    │   ├── SearchDropdown.jsx
    │   ├── CompanyProfile.jsx
    │   ├── BillingSubscription.jsx
    │   ├── UserManagement.jsx
    │   ├── SecuritySso.jsx
    │   ├── RolesPermission.jsx       # RBAC matrix (Settings tab)
    │   ├── EditHeadOfficeModal.jsx
    │   ├── EditProjectModal.jsx
    │   ├── CreateApprovalGroupModal.jsx
    │   ├── PersonalInformation.jsx
    │   ├── WorkInformation.jsx
    │   ├── DependentTab.jsx
    │   ├── DocumentsTab.jsx          # employee documents — live-fetched
    │   ├── AttendanceTab.jsx
    │   ├── PayrollTab.jsx
    │   ├── OverviewTab.jsx           # employee overview — live-fetched
    │   ├── LocationPicker.jsx
    │   ├── LocationPickerModal.jsx   # leaflet + LocationIQ
    │   └── MapPicker.jsx
    │
    ├── pages/                   # routed top-level pages grouped by domain
    │   ├── PageTemplate.jsx
    │   ├── auth/                # Login, SignUp, ForgotPassword, VerifyOtp, ResetPassword
    │   ├── dashboard/           # Dashboard.jsx — executive overview
    │   ├── employees/           # Employees, EmployeeDetail, AddEmployee
    │   ├── attendance/          # Attendance, DailyAttendanceLog, OvertimeRequest, OvertimeApprovalDetail
    │   ├── payroll/             # PayrollOverview
    │   ├── documents/           # Documents, AddNewDocument
    │   ├── contract/            # Contracts
    │   ├── leaves/              # LeaveManagement, ApplyLeave, LeavePolicy, LeaveCalender, ReviewLeaveRequest
    │   ├── projects/            # Projects, CreateProject, ProjectDetail, AssignEmployees
    │   ├── headOffices/         # HeadOffices, CreateHeadOffice
    │   ├── staffingCompanies/   # StaffingCompanies, AddStaffingCompany, StaffingCompanyDetails, InvoiceView, AssignContractEmployees
    │   ├── invoice/             # Invoices, InvoiceDetail
    │   ├── settings/            # Settings.jsx — tabs (Company Profile, User Management, Roles & Permissions, Billing & Subscriptions, Security & SSO, Notification)
    │   ├── profile/             # Profile.jsx
    │   ├── searchResult/        # SearchResult.jsx
    │   └── approval/            # Approval.jsx
    │
    └── utils/
        └── assets.js            # shared image/icon imports
```

---

## Architecture

The app is a single-page React 19 application bootstrapped by [src/main.jsx](src/main.jsx):

```jsx
<Provider store={store}>
  <BrowserRouter>
    <App />
  </BrowserRouter>
</Provider>
```

[src/App.jsx](src/App.jsx) mounts the router and a single global `<ToastContainer />` for `react-toastify`.

Every authenticated page wraps its content in [src/layouts/MainLayout.jsx](src/layouts/MainLayout.jsx) which renders:

- A persistent collapsible `<Sidebar />` on the left (auto-collapsed under `lg` breakpoint)
- A sticky `<Header />` at the top (search, notifications, profile)
- A scrollable `<main>` for page content

Auth-related pages (Login, SignUp, ForgotPassword, etc.) use a two-column layout with `<AuthLeft />` instead of `MainLayout`.

---

## State Management (Redux Toolkit)

The store is configured in [src/redux/store.js](src/redux/store.js):

```js
configureStore({
  reducer: {
    auth: authReducer,
    office: officeReducer,
    project: projectReducer,
    employee: employeeReducer,
  },
})
```

### Slice anatomy

Every domain slice follows the same shape:

```js
state = {
  list: [],              // collection from GET_ALL
  current: null,         // entity from GET_BY_ID
  loading: false,        // list fetch
  detailLoading: false,  // single-entity fetch
  createLoading: false,
  updateLoading: false,
  deleteLoading: false,
  error: null,
}
```

Each slice exports:

- Async thunks created with `createAsyncThunk` — `fetchX`, `fetchXById`, `createX`, `updateX`, `deleteX`
- Sync reducers — `clearCurrentX`, `clearXError`
- A default-exported reducer

### Response unwrapping

Backends return responses as `{ statusCode, success, message, data: { ... } }`. Each slice has helper functions:

```js
const unwrap = (payload) =>
  payload?.data !== undefined ? payload.data : payload

const unwrapList = (payload) => {
  const inner = unwrap(payload)
  if (Array.isArray(inner)) return inner
  return inner?.employees || inner?.offices || inner?.projects || inner?.list || inner?.items || []
}
```

This makes the slice tolerant of several common envelope shapes.

### Auth persistence

`auth.slice.js` hydrates from `localStorage` on init and persists `user` + `token` on every login. On `logout`, both keys are cleared.

```js
const initialState = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  ...
}
```

---

## API Layer

### Axios instance

[src/services/api.js](src/services/api.js) creates a shared axios instance:

```js
const API = axios.create({
  baseURL: API_ENDPOINTS.BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Request interceptor — attaches the bearer token automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```

Every domain service imports this single `API` instance — no per-call configuration.

### Endpoint constants

[src/constants/api.js](src/constants/api.js) is the single source of truth for paths. Grouped per domain:

```
API_ENDPOINTS = {
  BASE_URL,
  AUTH, DASHBOARD, EMPLOYEE, RBAC, UPLOAD,
  ATTENDANCE, PAYROLL, DOCUMENTS, CONTRACTS, LEAVES,
  PROJECTS, HEAD_OFFICES, STAFFING_COMPANIES, INVOICES, SETTINGS,
}
```

`:id` placeholders are substituted by services via `path.replace(':id', id)`.

### Service files

Per-domain modules under `src/services/` wrap the actual axios calls and return `response.data` (the unwrapped HTTP body).

Implemented today:
- `auth.services.js` — `signupApi`, `loginApi`
- `employee.services.js` — `createEmployeeApi`, `getEmployeesApi`, `getEmployeeByIdApi`, `updateEmployeeApi`, `deleteEmployeeApi`, **`uploadFileApi`**
- `office.services.js` — full CRUD for head offices
- `project.services.js` — full CRUD for projects

RBAC and document fetches are currently invoked inline in their respective components (`RolesPermission.jsx`, `DocumentsTab.jsx`) using the axios instance directly.

---

## Authentication & Authorization

### Login flow

1. `Login.jsx` collects `email` + `password` (with optional `fcm_token`)
2. Dispatches `loginUser` thunk → `POST /auth/login`
3. On success: backend returns `{ data: { user, access_token } }`
4. Thunk reducer writes `state.user`, `state.token`, `state.isAuthenticated`, and mirrors both to `localStorage`
5. `Login.jsx` watches `isAuthenticated` via `useEffect` and `navigate('/dashboard')`

### Token usage

The axios interceptor in `api.js` reads `localStorage.getItem('token')` on **every** outbound request and adds `Authorization: Bearer <token>`. Slices/services never handle the token directly.

### Logout

Triggered from `Sidebar.jsx` and `ProfileDropdown.jsx`. Dispatches `logout` action which clears redux + localStorage, then `navigate('/login')` with a success toast.

### Route guards

`src/routes/PrivateRoutes.jsx` is a guard wrapper that checks `state.auth.isAuthenticated` and redirects to `/` if not. **Currently every `<Route>` in `AppRoutes.jsx` has the guard commented out** — pages render publicly. Uncomment the wrappers when enforcement is needed (and fix the `isLoggedIn` vs `isAuthenticated` field name in `PrivateRoutes.jsx`).

---

## RBAC (Roles & Permissions)

The Settings → Roles & Permissions tab (rendered by [src/components/RolesPermission.jsx](src/components/RolesPermission.jsx)) provides the full RBAC management surface.

### Data model

- **Modules** (catalog, read-only) — fetched from `GET /rbac/modules`
- **Roles** (per-employer) — `GET /rbac/roles`, `POST /rbac/roles`, `PUT /rbac/roles/:id`, `DELETE /rbac/roles/:id`
- **Role permissions** (4 CRUD flags per role × module) — `PUT /rbac/roles/:id/permissions`
- **Employee role assignment** — `PUT /rbac/employees/:id/roles`, `GET /rbac/employees/:id/roles`, `GET /rbac/employees/:id/permissions`

### Permission flags

| UI column | API flag |
|---|---|
| View | `can_read` |
| Create | `can_create` |
| Edit | `can_update` |
| Delete | `can_delete` |

### Module metadata

The API only returns `{ id, module }` (e.g. `{ id: 5, module: "leave" }`). The component contains a `MODULE_META` map that attaches a friendly label, icon, and color per module name. Unknown modules fall back to a generic display.

### Component flow

- On mount: parallel fetch of modules + roles. First role auto-selected. Per-role permission matrix is initialized from each role's embedded `permissions` array.
- Switching role: pulls cached perms.
- Toggling a checkbox: updates local state only.
- **Save Changes** → `PUT /rbac/roles/:id/permissions` with the full matrix; updates server snapshot in redux on success.
- **Discard** → reverts local matrix to the cached server snapshot.
- **Create Custom Role** → `POST /rbac/roles` with `{ name, description, permissions: [] }`; new role is appended and auto-selected.

---

## Routing

Defined in [src/routes/AppRoutes.jsx](src/routes/AppRoutes.jsx). Selected highlights:

### Public

| Path | Component |
|---|---|
| `/` | `Login` |
| `/login` | `Login` |
| `/signup` | `SignUp` |
| `/forgot-password` | `ForgotPassword` |
| `/verify-otp` | `VerifyOTP` |
| `/reset-password` | `ResetPassword` |

### Authenticated (guard currently commented)

| Path | Component |
|---|---|
| `/dashboard` | `Dashboard` |
| `/dashboard/search-results` | `SearchResult` |
| `/employees` | `Employees` |
| `/employees/:id` | `EmployeeDetail` |
| `/employees/add-employee` | `AddEmployee` |
| `/attendance` | `Attendance` |
| `/attendance/daily-attendance` | `DailyAttendanceLog` |
| `/attendance/overtime-request` | `OvertimeRequest` |
| `/attendance/overtime-approval-detail` | `OvertimeApprovalDetail` |
| `/payroll-overview` | `PayrollOverview` |
| `/documents` | `Documents` |
| `/documents/add-new-document` | `AddNewDocument` |
| `/contracts` | `Contracts` |
| `/leave-management` | `LeaveManagement` |
| `/leave-management/apply-leave` | `ApplyLeave` |
| `/leave-management/leave-policy` | `LeavePolicy` |
| `/leave-management/leave-calender` | `LeaveCalendar` |
| `/leave-management/review-leave-request` | `ReviewLeaveRequest` |
| `/projects` | `Projects` |
| `/projects/create-project` | `CreateProject` |
| `/projects/project-detail/:id` | `ProjectDetail` |
| `/projects/project-detail/:id/assign-employees` | `AssignEmployees` |
| `/head-offices` | `HeadOffices` |
| `/head-offices/create-head-office` | `CreateHeadOffice` |
| `/staffing-companies` | `StaffingCompanies` |
| `/staffing-companies/add-staffing-company` | `AddStaffingCompany` |
| `/staffing-companies/company-detail/1` | `StaffingCompanyDetails` |
| `/staffing-companies/company-detail/1/view-invoice` | `InvoiceView` |
| `/staffing-companies/assign-contract-employees` | `AssignContractEmployees` |
| `/invoices` | `Invoices` |
| `/invoices/invoice-detail` | `InvoiceDetail` |
| `/settings` | `Settings` |
| `/profile` | `Profile` |

> Several routes still use literal `/1` segments (staffing companies) instead of `:id` placeholders — they should be promoted to dynamic params when those features are wired to the API.

---

## File Uploads

A dedicated, generic upload service is exposed in [src/services/employee.services.js](src/services/employee.services.js):

```js
uploadFileApi(file, category = 'general')
```

- **Endpoint:** `POST /upload?category=<profile|document|general>`
- **Body:** `multipart/form-data` with one field — `file`
- **Response:** `{ data: { url, file_name, file_type, size, category } }` — only `url` is consumed
- **Constraints (server-enforced):** Max 10 MB per file. Allowed types: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/gif`, `application/pdf`
- **Concurrency:** one file per request — loop on the client for multiple

### Used in

- **Employee creation** ([src/pages/employees/AddEmployee.jsx](src/pages/employees/AddEmployee.jsx)) — at submit, the profile photo and each document file are uploaded sequentially first, and the returned URLs are placed into `profile_url` and `documents[i].file_url` before `POST /employee`.

The "Save" button shows two distinct phases: **Uploading…** → **Creating…** so the user knows which network step is in flight.

---

## Forms & Validation

All forms use **react-hook-form**:

- Field registration via `register(name, rules)` — common rules include `required`, `pattern`, `minLength`, `maxLength`, and `validate: { noOnlySpaces, noDoubleSpaces, validChars, ... }`
- Multi-step forms (e.g. `AddEmployee.jsx`) advance via `trigger(stepFields)` to validate only the active step's fields before moving on
- Inline filters in `onInput` strip illegal characters live (e.g. digits-only for phone, no leading spaces in names)

### Cross-cutting validation patterns

| Rule helper | Behavior |
|---|---|
| `noOnlySpaces` | Rejects whitespace-only input |
| `noDoubleSpaces` | Rejects runs of two-or-more spaces |
| `validName` | Letters + single spaces only |
| `validChars` | Per-field allow-list regex |
| `minLen` / `maxLen` | Trimmed length checks |

### Reusable form atoms

`AddEmployee.jsx` defines `<Field>`, `<SelectWrapper>`, and shared `inputCls` / `selectCls` / `labelCls` strings — copy these into other feature pages for consistency.

---

## Notifications

`react-toastify` is configured globally in [src/App.jsx](src/App.jsx):

```jsx
<ToastContainer
  position="top-right"
  autoClose={3000}
  hideProgressBar={false}
  newestOnTop={false}
  closeOnClick
  pauseOnHover
  draggable
  theme="light"
/>
```

Use `toast.success(message)` / `toast.error(message)` / `toast.info(message)` from anywhere.

> `react-hot-toast` is also installed but currently unused — `react-toastify` is the project standard.

---

## Styling Conventions

- **Tailwind v4** is loaded via the `@tailwindcss/vite` plugin (registered in [vite.config.js](vite.config.js))
- The base `index.css` imports Tailwind. Global tweaks (scrollbar hiding, etc.) live alongside
- Cyan-600 (`bg-cyan-600`) is the primary brand color across CTAs, status, etc.
- Common class strings are extracted into shared constants per page (`inputBase`, `inputCls`, `labelCls`, `selectCls`)
- Status pills are built with three coordinated classes — text, bg, border (e.g. `text-green-700 bg-green-50 border-green-200`) and mapped via `STATUS_COLORS` / `STATUS_STYLE` objects per feature
- **Tailwind v4 canonical names:** prefer `shrink-0` over `flex-shrink-0`. The linter will warn on legacy class names — fix as you touch files
- Responsive: most pages have desktop tables (`hidden lg:block`) + mobile card stacks (`lg:hidden`)

---

## Maps / Geolocation

Used in `CreateProject.jsx` and head-office workflows.

- [src/components/LocationPickerModal.jsx](src/components/LocationPickerModal.jsx) — wraps a Leaflet map in a modal. Reverse geocoding via **LocationIQ** (uses `VITE_LOCATIONIQ_API_KEY`).
- [src/components/LocationPicker.jsx](src/components/LocationPicker.jsx) — non-modal embed variant.
- [src/components/MapPicker.jsx](src/components/MapPicker.jsx) — minimal lat/lng picker.

Selected location yields `{ position: { lat, lng }, address }` which feeds into the API payload as `lat`, `lng`, `radius_meters`, and `project_location` (for projects).

---

## Feature Modules

### Authentication ([src/pages/auth/](src/pages/auth/))

- **Login.jsx** — fully wired to `loginUser` thunk
- **SignUp.jsx** — placeholder stub (renders just `<div>SignUp</div>`)
- **ForgotPassword.jsx** — UI complete, calls `setTimeout` mock; needs API integration
- **VerifyOtp.jsx** — UI complete (6-digit OTP input with auto-focus, paste support, resend timer); mocked
- **ResetPassword.jsx** — UI complete with strength validation; mocked

### Dashboard ([src/pages/dashboard/Dashboard.jsx](src/pages/dashboard/Dashboard.jsx))

Executive overview. Currently entirely static — stat cards, donut chart (custom SVG), action center, payroll snapshot, compliance alerts, recent activity, active project overview. Ready for `GET /dashboard` integration.

### Employees ([src/pages/employees/](src/pages/employees/))

- **Employees.jsx** — Live. Lists employees from `GET /employee`, supports search by name/ID/email, filters by Project / Type / Role / Status, pagination, and click-through navigation to `/employees/:id`. Static "Staffing Co." column always renders `NA` because the API has no such field yet.
- **AddEmployee.jsx** — Live. 5-step wizard:
  1. Basic Information (full name, nationality, phone, email, country employee ID, address, profile photo)
  2. Job Details (employment type radio, designated role, project assignment) — `roles` fetched from `/rbac/roles`, `projects` fetched via `fetchProjects` thunk
  3. Salary Structure (base salary, monthly allowances, computed projected monthly net)
  4. Documents (drag-drop file picker; each document gets type, number, issuing authority, issue/expiry dates)
  5. Review
  On submit: photo → `/upload?category=profile`, each document file → `/upload?category=document`, then `POST /employee` with the resulting URLs.
- **EmployeeDetail.jsx** — Live. Reads `:id` from URL, dispatches `fetchEmployeeById`, renders dynamic header (name, role, project, status pill). 5 tabs: Overview, Attendance, Payroll, Documents, Dependent.

### Head Offices ([src/pages/headOffices/](src/pages/headOffices/))

- **HeadOffices.jsx** — Live. List from `GET /office?include_deleted=false`. Search by name/email/location. Original UI preserved (icons, status pills, avatar stacks, contractor count) with API-bound name/email/phone/location and decorated placeholders for visual-only fields. Edit opens inline modal. Delete button is a stub.
- **CreateHeadOffice.jsx** — Live. Form maps to `office_name`, `office_email`, `office_phone` (countryCode + phone concatenated), `office_location`. Photo UI is kept but not sent. On success → `/head-offices`.
- **EditHeadOfficeModal.jsx** — Live. Hydrates from selected office, dispatches `updateOffice`, syncs the list on success.

### Projects ([src/pages/projects/](src/pages/projects/))

- **Projects.jsx** — Live. List from `GET /project`. Search/Status/Location filters preserved (status/location filters are visual-only because the API returns `ACTIVE/INACTIVE/COMPLETED` mapped to UI labels "Active/On Hold/Completed"). "Total Employees" column now uses the API's `employee_count`. Edit opens `EditProjectModal`. View navigates to `/projects/project-detail/:id`.
- **CreateProject.jsx** — Live. Office dropdown is populated from `state.office.list` (fetched on mount). Location picker integrated. On submit: auto-generates a `project_code` (`PRJ-YYYY-XXXX`) and maps form values to the create payload (`project_name`, `project_code`, `description`, `project_location` from picked address, `start_date`, `end_date`, `office_id` from selected office, `lat`/`lng`, `radius_meters`, `status` enum). Photo upload UI kept; not sent.
- **ProjectDetail.jsx** — Live for the header (name, location, status, target completion). The "Attendance Summary", "Monthly Payroll Cost", and "Assigned Workforce" sections are still decorative mock data.
- **EditProjectModal.jsx** — Live. Maps form fields → API payload, dispatches `updateProject`.
- **AssignEmployees.jsx** — UI stub. No API wired yet.

### Attendance ([src/pages/attendance/](src/pages/attendance/))

- **Attendance.jsx**, **DailyAttendanceLog.jsx**, **OvertimeRequest.jsx**, **OvertimeApprovalDetail.jsx** — All UI-complete with static mock data. Endpoints exist in `constants/api.js` (`/attendance`) but no service or slice yet.

### Payroll ([src/pages/payroll/PayrollOverview.jsx](src/pages/payroll/PayrollOverview.jsx))

UI complete with mock data. Endpoints defined; no service / slice yet.

### Documents ([src/pages/documents/](src/pages/documents/))

- **Documents.jsx** — list page (mock)
- **AddNewDocument.jsx** — upload form (mock; uses local file preview)

Inside employee detail, [src/components/DocumentsTab.jsx](src/components/DocumentsTab.jsx) **is live** — fetches `GET /employee/:id/documents`. Computes status (VALID / EXPIRING SOON / EXPIRED) from `expiry_date`. Empty state: "No documents to show".

### Leaves ([src/pages/leaves/](src/pages/leaves/))

- **LeaveManagement.jsx**, **ApplyLeave.jsx**, **LeavePolicy.jsx**, **LeaveCalender.jsx**, **ReviewLeaveRequest.jsx** — All UI-complete with mock data. Endpoints listed in `constants/api.js`. No service / slice yet.

### Contracts ([src/pages/contract/Contracts.jsx](src/pages/contract/Contracts.jsx))

UI-only.

### Invoices ([src/pages/invoice/](src/pages/invoice/))

`Invoices.jsx`, `InvoiceDetail.jsx` — UI-only.

### Staffing Companies ([src/pages/staffingCompanies/](src/pages/staffingCompanies/))

`StaffingCompanies.jsx`, `AddStaffingCompany.jsx`, `StaffingCompanyDetails.jsx`, `InvoiceView.jsx`, `AssignContractEmployees.jsx` — UI-only.

### Settings ([src/pages/settings/Settings.jsx](src/pages/settings/Settings.jsx))

Tabbed page. Tabs:

1. **Company Profile** → `<CompanyProfile />`
2. **User Management** → `<UserManagement />`
3. **Roles & Permissions** → `<RolesPermissions />` (live — RBAC)
4. **Billing & Subscriptions** → `<BillingSubscriptions />`
5. **Security & SSO** → `<SecuritySsO />`
6. **Notification** → `<NotificationSettings />`

Only the Roles & Permissions tab is API-wired today.

### Profile ([src/pages/profile/Profile.jsx](src/pages/profile/Profile.jsx))

User profile page. UI-only.

### Search Result ([src/pages/searchResult/SearchResult.jsx](src/pages/searchResult/SearchResult.jsx))

Global-search results page. UI-only.

### Approval ([src/pages/approval/Approval.jsx](src/pages/approval/Approval.jsx))

Approval workflow placeholder.

---

## Components Reference

### Shared chrome

- **`Sidebar.jsx`** — 12 menu items, collapses below `lg`, active-route indicator, embedded user card + logout
- **`Header.jsx`** — global search (mock data via `SearchDropdown`), notifications panel, profile dropdown. Notifications drop-down panel is rendered by `NotificationPanel.jsx`
- **`AuthLeft.jsx`** — branded left pane used by all unauthenticated pages
- **`ProfileDropdown.jsx`** — Profile link + Log out button (dispatches `logout`)
- **`MainLayout.jsx`** — layout primitive (Sidebar + Header + scrollable main)

### Modals

- **`EditHeadOfficeModal.jsx`** — backdrop, scrollable body, fixed header/footer; hydrates form on open
- **`EditProjectModal.jsx`** — same pattern, for projects
- **`CreateApprovalGroupModal.jsx`** — approval group creation modal
- **`LocationPickerModal.jsx`** — full-screen map for coordinate selection

### Employee detail tabs

- **`OverviewTab.jsx`** — live; reads `state.employee.current`. Personal info (name, email, phone if available, nationality), Employment Details (type, current role from first assigned role, active project), Compensation Summary (base salary + extra allowance), Recent Activity (static)
- **`AttendanceTab.jsx`** — static
- **`PayrollTab.jsx`** — static
- **`DocumentsTab.jsx`** — live; fetches `GET /employee/:id/documents`
- **`DependentTab.jsx`** — static

### Settings tab components

- **`CompanyProfile.jsx`**, **`UserManagement.jsx`**, **`RolesPermission.jsx`** (live), **`BillingSubscription.jsx`**, **`SecuritySso.jsx`**, **`NotificationSettings.jsx`**

### Other

- **`PersonalInformation.jsx`**, **`WorkInformation.jsx`** — personal/work info detail panels

---

## Backend API Reference

The frontend talks to a HRMS REST API. All paths in this section are appended to `VITE_BASE_URL`. All authenticated requests carry `Authorization: Bearer <jwt>`.

### Auth

```
POST   /auth/login              { email, password, fcm_token? } → { data: { user, access_token } }
POST   /auth/signup
POST   /auth/logout
POST   /auth/forgot-password
POST   /auth/verify-otp
POST   /auth/reset-password
```

### Employees

```
GET    /employee                          → { data: { employees: [...] } }
POST   /employee                          ← see payload below
GET    /employee/:id                      → { data: { employee: {...} } }
PUT    /employee/:id
DELETE /employee/:id
GET    /employee/:id/documents            → { data: { documents: [...] } }
```

**Create payload:**

```json
{
  "full_name": "Alice Sharma",
  "email": "alice@acme.com",
  "phone_number": "+919876543210",
  "address": "12 Main Street, Andheri East, Mumbai 400069",
  "country_emp_id": "EMP-101",
  "role_id": 1,
  "base_salary": 50000,
  "extra_allowance": 5000,
  "nationality": "Indian",
  "employment_type": "FULL_TIME",
  "project_id": 5,
  "profile_url": "https://cdn.example.com/photos/alice.jpg",
  "documents": [
    {
      "document_type": "PASSPORT",
      "document_number": "J1234567",
      "issuing_authority": "Government of India",
      "issue_date": "2022-01-15",
      "expiry_date": "2032-01-14",
      "file_url": "https://cdn.example.com/docs/alice-passport.pdf"
    }
  ]
}
```

`employment_type` enum: `FULL_TIME` | `CONTRACT`
`document_type` enum: `PASSPORT` | `IQAMA` | `NATIONAL_ID` | `DRIVER_LICENSE` | `WORK_PERMIT` | `OTHER`

### Head Offices

```
GET    /office?include_deleted=false
POST   /office                            { office_name, office_email, office_phone, office_location }
GET    /office/:id
PUT    /office/:id
DELETE /office/:id
```

### Projects

```
GET    /project                           → { data: { projects: [...] } } (includes office + employee_count)
POST   /project                           ← see payload
GET    /project/:id
PUT    /project/:id
DELETE /project/:id
```

**Create payload:**

```json
{
  "project_name": "Skyline Tower",
  "project_code": "PROJ-0001",
  "description": "Premium residential tower at BKC",
  "project_location": "Bandra Kurla Complex, Mumbai",
  "start_date": "2026-06-01",
  "end_date": "2027-12-31",
  "office_id": 1,
  "lat": 19.0760,
  "lng": 72.8777,
  "radius_meters": 200,
  "status": "ACTIVE"
}
```

`status` enum: `ACTIVE` | `INACTIVE` | `COMPLETED`. `office_id` is unique — one office can attach to at most one project. `project_code` is unique per employer.

### RBAC

```
GET    /rbac/modules                       → { data: { modules: [...] } }
GET    /rbac/roles                         → list with embedded permissions
POST   /rbac/roles                         { name, description?, permissions?: [...] }
GET    /rbac/roles/:id
PUT    /rbac/roles/:id                     { name?, description? }
DELETE /rbac/roles/:id                     (400 if any employee still assigned)
PUT    /rbac/roles/:id/permissions         { permissions: [{ module_id, can_create, can_read, can_update, can_delete }] }
PUT    /rbac/employees/:id/roles           { role_ids: number[] }
GET    /rbac/employees/:id/roles
GET    /rbac/employees/:id/permissions
```

### Uploads

```
POST   /upload?category=<profile|document|general>
       Content-Type: multipart/form-data
       form field: file (single)
       Max 10 MB
       Allowed: image/jpeg, jpg, png, webp, gif, application/pdf
       → { data: { url, file_name, file_type, size, category } }
```

### Defined but not yet wired

Endpoints exist in `constants/api.js` for the following, but no service file or slice has been written yet — pages currently render mock data:

- `DASHBOARD` (`/dashboard`)
- `ATTENDANCE` (`/attendance`, `/attendance/:id`, `/attendance/create`)
- `PAYROLL` (`/payroll`, `/payroll/:id`, `/payroll/create`)
- `DOCUMENTS` (`/documents`, `/documents/:id`, `/documents/upload`, `/documents/:id` delete)
- `CONTRACTS` (`/contracts`, `/contracts/:id`, `/contracts/create`)
- `LEAVES` (`/leaves/apply`, `/leaves`, `/leaves/:id`, `/leaves/policy`, `/leaves/calendar`, `/leaves/:id/approve`, `/leaves/:id/reject`)
- `STAFFING_COMPANIES` (`/staffing-companies` family)
- `INVOICES` (`/invoices` family)
- `SETTINGS` (`/settings`, `/settings/:id`)

---

## Known Gaps / TODOs

| Area | Status | Notes |
|---|---|---|
| `PrivateRoute` guard | Disabled | Every `<PrivateRoute>` is commented out in `AppRoutes.jsx`; pages render publicly. Re-enable when ready, and fix `state.auth.isLoggedIn` → `state.auth.isAuthenticated` mismatch in `PrivateRoutes.jsx`. |
| Project detail page tabs | Partial | Header is dynamic; Attendance / Payroll / Workforce sections are mock |
| Employee Attendance / Payroll / Dependent tabs | Mock | Static data only |
| Dashboard | Mock | All cards/charts static |
| Leaves / Payroll / Attendance / Contracts pages | Mock | API endpoints defined but no service/slice/wiring |
| Staffing Companies | Mock | Whole module pending |
| Invoices | Mock | Whole module pending |
| Notifications panel | Mock | `ALL_NOTIFICATIONS` is hardcoded inside `Header.jsx` |
| Global search | Mock | `SearchDropdown` shows hardcoded results |
| `SignUp.jsx` | Placeholder | Returns `<div>SignUp</div>` only |
| ForgotPassword / VerifyOtp / ResetPassword | UI-only | Need API integration |
| Delete buttons | Disabled stubs | Office delete shows "Delete is not available yet" toast; project delete button absent |
| `react-hot-toast` dep | Unused | Installed but project standard is `react-toastify` — remove from `package.json` if not needed |
| `auth.slice.js` artifacts | Minor | `console.log("action payload", ...)` leftover; `loginUser.rejected` sets `error: true` instead of message; `signupUser.fulfilled` does nothing with payload |
| Tailwind v4 warnings | Minor | `flex-shrink-0` should become `shrink-0` across older components — lint warns on each |
| Project context dropdown in header | Planned | Designed; needs the "user's projects" endpoint to wire |

---

## Conventions for New Features

When wiring a new domain (e.g. `leaves`), follow the pattern established by `office`, `project`, and `employee`:

1. **Add endpoint constants** to `src/constants/api.js` under a new group
2. **Create `src/services/<domain>.services.js`** — one named export per API call, all returning `response.data`
3. **Create `src/redux/slice/<domain>.slice.js`** — copy the structure of `office.slice.js`:
   - Shared `extractMessage`, `unwrap`, `unwrapList` helpers
   - 5 thunks (`fetchAll`, `fetchById`, `create`, `update`, `delete`)
   - State shape: `{ list, current, loading, detailLoading, createLoading, updateLoading, deleteLoading, error }`
   - Sync reducers `clearCurrent<Domain>` / `clear<Domain>Error`
4. **Register the reducer** in `src/redux/store.js`
5. **Wire the page** — dispatch fetch on mount, `useSelector` to read, toast on error, navigate on success
6. **Defensive payload unwrap** — backend wraps in `{ data: { <singular_key>: ... } }`; check the API doc per endpoint
7. **Preserve UI** unless explicitly asked to change it. When the API doesn't provide a field, fall back to `"NA"` / `"—"` / placeholders rather than removing UI elements

---

## License

Internal — proprietary to Fyinder.