# Smart Traffic-Aware Navigation System (STANS)

A traffic-aware navigation system that helps individuals and businesses find efficient routes using graph algorithms, traffic conditions, blockades, and distance.

## Project URL

https://roadmap.sh/projects/stans-navigation-deployment

## Repository URL

https://github.com/Dakshmulundkar/STANS

## Project Overview

This project is a React and TypeScript application for visualizing and analyzing graph-based route planning. It includes route optimization, graph building, algorithm comparison, performance benchmarking, and interactive visualizations.

For the roadmap.sh deployment project, this repository was containerized with Docker, served with Nginx, and automated with GitHub Actions CI/CD.[page:1]

## Features

- Interactive 2D and 3D graph visualization
- Route calculation between nodes
- Graph builder for custom nodes and edges
- Graph templates such as Grid, Tree, Complete, Bipartite, and Star
- Comparison of Kruskal's, Prim's, and Dijkstra's algorithms
- Performance benchmarking for graph algorithms
- Graph metrics analysis
- Import and export with JSON and CSV
- Interactive tutorial

## Technologies Used

- React
- TypeScript
- Vite
- Tailwind CSS
- Three.js
- Framer Motion
- Recharts
- Docker
- Nginx
- GitHub Actions

## Deployment Work

This repository includes the following deployment tasks from the roadmap.sh project:[page:1]

- Multi-stage Docker build for the React application
- Nginx configuration for serving the production build
- Support for React client-side routing
- GitHub Actions workflow for build validation and container publishing
- GitHub Container Registry integration

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

## Docker

Build and run locally:

```bash
docker build -t stans-app .
docker run -p 8080:80 stans-app
```

Then open:

```text
http://localhost:8080
```

## CI/CD

GitHub Actions workflow file:

```text
.github/workflows/deploy.yml
```

This workflow:
- triggers on push to `main`
- verifies the app builds successfully
- builds the Docker image
- pushes the image to GitHub Container Registry

## Container Image

Published image:

```text
ghcr.io/dakshmulundkar/stans-app:latest
```

## Demo

Demo video or screenshots will be added here.

## License

This project is maintained as part of a learning and deployment exercise based on the roadmap.sh STANS deployment project.