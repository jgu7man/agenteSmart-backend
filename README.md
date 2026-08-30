# ⚙️ AgenteSmart Backend — Serverless Dialogflow Orchestrator

[![Firebase Functions](https://img.shields.io/badge/Serverless-Cloud%20Functions-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com)
[![Firestore](https://img.shields.io/badge/Database-Cloud%20Firestore-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/docs/firestore)
[![Dialogflow API](https://img.shields.io/badge/AI-Dialogflow%20v2%20API-FF6F00?style=flat-square&logo=googlecloud&logoColor=white)](https://cloud.google.com/dialogflow)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

A Serverless **Firebase Cloud Functions & Cloud Firestore** backend responsible for orchestrating **Google Dialogflow v2** agent communication, session persistence, user authentication, and real-time event triggers.

Part of the **AgenteSmart Full-Stack Suite**:
- 🖥️ [**`agenteSmart-frontend`**](https://github.com/jgu7man/agenteSmart-frontend) (Visual Angular Dashboard)
- ⚙️ [**`agenteSmart-backend`**](https://github.com/jgu7man/agenteSmart-backend) (Firebase Cloud Functions & Firestore API)
- ⚡ [**`agentesmart-ws`**](https://github.com/jgu7man/agentesmart-ws) (Real-Time WebSockets WhatsApp Bridge)

---

## 🏗️ Architecture & Responsibilities

```mermaid
flowchart TD
    Front["🖥️ agenteSmart-frontend"] --> Auth["🔐 Firebase Auth Guard"]
    Auth --> Functions["⚡ Firebase Cloud Functions (Node.js/Express)"]
    Functions --> Firestore["📦 Cloud Firestore (Sessions, Intents & Analytics)"]
    Functions --> DialogflowSDK["🤖 Google Cloud Dialogflow v2 SDK"]
    Functions <--> WS["⚡ agentesmart-ws (WebSockets Gateway)"]
```

---

## ✨ Key Capabilities

- 🤖 **Dialogflow SDK Abstraction:** Wraps Google Cloud Dialogflow v2 API with simplified endpoints for intent training and session state resolution.
- 📦 **Multi-Tenant Session Store:** Stores historical conversational turns and user session states on Cloud Firestore.
- 🛡️ **Security Rules & Validation:** Enterprise-grade Firestore security rules preventing unauthorized data mutations.

---

## 📄 License
Distributed under the [MIT License](LICENSE). Created by [Jorge Guzmán (@jgu7man)](https://github.com/jgu7man).
