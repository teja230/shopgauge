# Contributing to ShopGauge

Thank you for your interest in contributing to ShopGauge! We welcome contributions from the community to help improve
our project. Please read the following guidelines to help us maintain a high standard of quality and collaboration.

## How to Contribute

1. **Fork the Repository**
    - Click the "Fork" button at the top right of this repository to create your own copy.

2. **Clone Your Fork**
    - Clone your forked repository to your local machine:

      ```bash
      git clone https://github.com/your-username/storesight.git
      ```

3. **Create a Branch**
    - Create a new branch for your feature or bugfix:

      ```bash
      git checkout -b feature/your-feature-name
      ```

4. **Make Your Changes**
    - Make your changes in the appropriate files. Please follow the code style and conventions used in the project.

5. **Test Your Changes**
    - Ensure that your changes do not break existing functionality. Run tests and lint your code:
        - For backend (Java):
          ```bash
          ./gradlew test
          ```
        - For frontend (Node.js):
          ```bash
          npm run lint
          npm run test
          ```

6. **Commit and Push**
    - Commit your changes with a clear and descriptive message:

      ```bash
      git commit -m "Add feature: description of your feature"
      git push origin feature/your-feature-name
      ```

7. **Open a Pull Request**
    - Go to the original repository and open a pull request from your branch. Please provide a clear description of your
      changes and reference any related issues.

## Code Style

- **Java (Backend):**
    - Follow standard Java conventions.
    - Use meaningful variable and method names.
    - Keep methods short and focused.
    - Use comments where necessary.
- **TypeScript/JavaScript (Frontend):**
    - Follow the existing ESLint and Prettier configurations.
    - Use functional components and hooks for React.
    - Write clear and concise code.

## Commit Messages

- Use clear, descriptive commit messages.
- Reference issues where applicable (e.g., `Fixes #123`).

## Reporting Issues

If you find a bug or have a feature request, please open an issue. Include as much detail as possible to help us
understand and address your request.

## Code of Conduct

Please be respectful and considerate in all interactions. We are committed to providing a welcoming and inclusive
environment for everyone.

## Questions?

If you have any questions, feel free to open an issue or contact the maintainers.

Thank you for contributing to StoreSight!
