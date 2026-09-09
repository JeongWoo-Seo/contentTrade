import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import novelRoutes from "./routes/novel.routes.js";
import { errorHandler } from "./utils/errors.js";

const app = express();

// CORS: credentials enabled so the frontend can send/receive the HttpOnly
// refresh cookie across origins (localhost:5173 -> localhost:8080).
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.json({
    message: "Novel Market Server",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/novels", novelRoutes);

// Error handler 향후 등록 필요
app.use(errorHandler);

export default app;
