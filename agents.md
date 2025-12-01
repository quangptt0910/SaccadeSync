# SaccadeSync - Agent Instructions

This document provides guidance for LLM agents working on this React codebase.

## Project Overview

SaccadeSync is an eye-tracking application for identifying traits of ADHD or fatigue through saccade tests.

## Technology Stack

- **React 18** - UI library
- **React Router DOM 6** - Client-side routing
- **Redux Toolkit** - State management
- **React Redux** - React bindings for Redux
- **Create React App** - Build tooling

## Directory Structure

```
src/
├── index.js           # App entry point, providers setup
├── App.js             # Main app with route definitions
├── components/        # Reusable UI components
│   ├── index.js       # Component exports
│   ├── Button/        # Button component
│   ├── Input/         # Form input component
│   ├── Layout/        # Page layout wrapper
│   └── Navbar/        # Navigation bar
├── views/             # Page-level components (routes)
│   ├── index.js       # View exports
│   ├── Home/          # Homepage (/)
│   ├── Login/         # Login page (/login)
│   └── Results/       # Results page (/results)
├── store/             # Redux store configuration
│   ├── index.js       # Store setup
│   └── authSlice.js   # Authentication state slice
└── styles/            # Global styles
    └── global.css     # Base styles, resets
```

## Key Patterns

### Component Structure
Each component follows this pattern:
```
ComponentName/
├── index.js           # Component logic and JSX
└── ComponentName.css  # Component-specific styles
```

### Adding New Components
1. Create folder in `src/components/`
2. Add `index.js` with component code
3. Add CSS file for styles
4. Export from `src/components/index.js`

### Adding New Views (Pages)
1. Create folder in `src/views/`
2. Add `index.js` with view component
3. Add CSS file for styles
4. Export from `src/views/index.js`
5. Add route in `src/App.js`

### Redux State
- Use `createSlice` from Redux Toolkit
- Define selectors in slice files
- Export actions and selectors together
- Access state via `useSelector` hook
- Dispatch actions via `useDispatch` hook

## Navigation

Routes are defined in `App.js` using React Router:
- `/` - Home page
- `/login` - Login page
- `/results` - Results page (shows user data if authenticated)

Use `<Link>` for navigation, `useNavigate()` for programmatic navigation.

## State Management

### Auth State (authSlice)
```javascript
{
  user: { email, name } | null,
  isAuthenticated: boolean,
  loading: boolean,
  error: string | null
}
```

Available actions: `login`, `logout`, `setLoading`, `setError`
Available selectors: `selectUser`, `selectIsAuthenticated`, `selectAuthLoading`, `selectAuthError`

## Common Tasks for Agents

### Adding a new page
1. Create view in `src/views/NewPage/`
2. Add route in `App.js`
3. Add navigation link in `Navbar`

### Adding a new Redux slice
1. Create slice file in `src/store/`
2. Add reducer to store in `src/store/index.js`
3. Export actions and selectors

### Modifying components
- Keep styles in component's CSS file
- Use BEM-like naming: `.component__element--modifier`
- Import shared components from `../../components`

## File Naming Conventions

- **Components/Views**: PascalCase folders, `index.js` for main file
- **Redux slices**: camelCase with `Slice` suffix (e.g., `authSlice.js`)
- **CSS files**: Match component/view name (e.g., `Button.css`, `Home.css`)
- **Utilities/Helpers**: camelCase (future: `src/utils/`, `src/helpers/`)

## Important Notes

- All imports use relative paths
- CSS is component-scoped (each component has its own CSS file)
- Global styles only in `src/styles/global.css`
- Use `index.js` barrel exports for cleaner imports
- Redux state should be accessed only through selectors
