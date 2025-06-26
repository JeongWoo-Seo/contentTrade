import { getAllDataList } from "../db/mysql.js";

export const getAllContentListController = async (req, res) => {
    try {
        const dataList = await getAllDataList();

        if (dataList.flag === false) {
            return res.send({ flag: false, message: "콘텐츠가 존재하지 않습니다." });
        }

        res.send({ flag: true, data: dataList.data });
    } catch (error) {
        console.error("getAllContentListController 오류:", error);
        res.status(500).send({ flag: false, message: "Database 오류가 발생했습니다." });
    }
};
