# Zyntrain AI

**Zyntrain AI** is an intelligent task management platform that learns your habits, plans your day, and syncs seamlessly with Google Calendar. It transforms chaos into clarity by optimizing your schedule for peak productivity.

---

## 🚀 Overview

Zyntrain AI is an **AI-powered productivity assistant** built to automate planning and time management.
It integrates directly with **Google Calendar** to intelligently organize your schedule, prioritize your tasks, and adapt to your work habits over time.

**Status**: Beta (Active Development)

---

## ✨ Features

- **🤖 AI Scheduling**: Automatically arranges and prioritizes tasks based on context, urgency, and workload.
- **📅 Google Calendar Sync**: Real-time synchronization of events, reminders, and tasks.
- **🧠 Behavioral Learning**: Adapts to your unique work patterns and energy levels.
- **⚡ Energy-Based Planning**: Schedules demanding tasks during your peak energy hours.
- **🔒 Enterprise-Grade Security**:
    - **Anti-SQL Injection**: Robust protection using Sequelize ORM.
    - **XSS & HPP Protection**: Advanced sanitization and parameter pollution prevention.
    - **Strict CORS**: Secure cross-origin resource sharing policies.
    - **Rate Limiting**: Protection against abuse and DDoS attacks.

---

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite (via Sequelize ORM)
- **Security**: Helmet, xss-clean, hpp, bcrypt, jsonwebtoken
- **Validation**: Joi

### Frontend
- **Core**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Design**: Custom CSS Variables, Glassmorphism, Responsive Layouts
- **Effects**: Particle Systems, Magnetic Buttons, Custom Cursors

---

## 📦 Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/Inv-Wolve/Zyntrain-AI.git
    cd Zyntrain-AI
    ```

2.  **Install Backend Dependencies**
    ```bash
    cd backend
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file in the `backend` directory:
    ```env
    PORT=4567
    JWT_SECRET=your_secure_secret
    NODE_ENV=development
    ```

4.  **Start the Server**
    ```bash
    npm start
    ```

5.  **Run Frontend**
    Open `Zyntrain/index.html` in your browser or serve it using a static file server (e.g., Live Server).

---

## 🛡️ Security

Zyntrain AI prioritizes security by design:
- **Input Validation**: All API inputs are strictly validated using Joi schemas.
- **Data Sanitization**: Incoming data is sanitized to prevent XSS attacks.
- **Secure Headers**: Helmet sets appropriate HTTP headers for security.
- **Authentication**: JWT-based stateless authentication with secure password hashing.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the project
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0**. See the `LICENSE` file for details.

---

> _Train your focus. Automate your flow._
> — **Zyntrain AI**
