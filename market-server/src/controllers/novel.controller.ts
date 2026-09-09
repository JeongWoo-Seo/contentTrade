import type { Request, Response } from "express";
import { novelService } from "../services/novel.service.js";
import { asyncHandler } from "../utils/errors.js";

export const novelController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const { title, description, content, price } = req.body ?? {};
    const registration = await novelService.registerNovel(req.userId!, { title, description, content, price });
    res.status(201).json(registration);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const result = await novelService.listNovels(req.query.page, req.query.size);
    res.json(result);
  }),

  listMine: asyncHandler(async (req: Request, res: Response) => {
    const result = await novelService.listMyRegistrations(req.userId!, req.query.page, req.query.size);
    res.json(result);
  }),
};
