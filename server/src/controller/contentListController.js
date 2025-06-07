import { getAllDataList } from "../db/mysql.js";

export const getAllContentListController = async (req, res) => {
    try {
        const dataList = await getAllDataList();

        if (!dataList || dataList.length === 0) {
            return res.send({ flag: false, message: "콘텐츠가 존재하지 않습니다." });
        }

        res.send({ flag: true, data: dataList });
    } catch (error) {
        console.error("Error in getAllContentListController:", error);
        res.status(500).send({ flag: false, message: "서버 오류가 발생했습니다." });
    }
};
