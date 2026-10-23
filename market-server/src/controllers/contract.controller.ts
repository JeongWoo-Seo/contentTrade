import type { Request, Response } from "express";
import { contractService } from "../services/contract.service.js";
import { asyncHandler } from "../utils/errors.js";

export const contractController = {
  getAddresses: asyncHandler(async (_req: Request, res: Response) => {
    const result = await contractService.getAddresses();
    res.json(result);
  }),
};
