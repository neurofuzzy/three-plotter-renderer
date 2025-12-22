# Contributing to three-plotter-renderer

Thank you for your interest in contributing! This project welcomes contributions of all kinds.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/three-plotter-renderer.git`
3. Install dependencies: `npm install`
4. Start the dev server: `npm run dev`

## Development Workflow

```bash
npm run dev      # Start Vite dev server with hot reload
npm run build    # Build production bundles
npm run test     # Run tests with Vitest
```

## Project Structure

```
├── src/                 # Source files
│   ├── plotter-renderer.js   # Main renderer
│   ├── projector.js          # Scene projection
│   └── geom/                 # Geometry utilities
├── examples/            # Demo examples
├── tests/               # Test files
└── dist/                # Built output
```

## Making Changes

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Test your changes with the examples
4. Commit with a clear message: `git commit -m "Add feature X"`
5. Push and open a Pull Request

## Code Style

- Use ES modules
- Keep functions focused and well-documented
- Maintain compatibility with Three.js

## Reporting Issues

When reporting bugs, please include:
- Browser and version
- Three.js version
- Steps to reproduce
- Expected vs actual behavior

## Questions?

Open an issue or reach out to [@neurofuzzy](https://github.com/neurofuzzy).
