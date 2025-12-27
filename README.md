# SaccadeSync

Eye-tracking application for identifying traits of ADHD or fatigue through saccade tests.

## Getting Started

### Prerequisites

- Node.js (v16 or higher recommended)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/quangptt0910/SaccadeSync.git
cd SaccadeSync
```

2. Install dependencies:
```bash
npm install
```

### Running the App

Start the development server:
```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000).

### Building for Production

Create an optimized production build:
```bash
npm run build
```

The build output will be in the `build/` folder.

## Project Structure

```
src/
├── index.js           # Entry point
├── App.js             # Root component with routes
├── components/        # Reusable UI components
│   ├── Button/
│   ├── Input/
│   ├── Layout/
│   └── Navbar/
├── views/             # Page components
│   ├── Home/
│   ├── Login/
│   └── Results/
├── store/             # Redux state management
│   ├── index.js
│   └── authSlice.js
└── styles/            # Global styles
    └── global.css
```

## Available Routes

| Route | Description |
|-------|-------------|
| `/` | Home page with app introduction |
| `/login` | User login page |
| `/results` | Test results (requires login) |

## Technologies

- **React 18** - UI framework
- **React Router DOM 6** - Navigation
- **Redux Toolkit** - State management
- **Create React App** - Build configuration

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run development server |
| `npm run build` | Create production build |
| `npm test` | Run tests |
| `npm run eject` | Eject from CRA (one-way) |

## Development

See [agents.md](./agents.md) for detailed development guidelines and project conventions.

## License

MIT
