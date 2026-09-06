import express from "express";

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Novel Market Server",
  });
});

export default app;