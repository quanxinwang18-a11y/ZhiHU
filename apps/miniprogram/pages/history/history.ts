import type { StoredAdviceRun } from "../../domain/advice";
import {
  clearAdviceRuns,
  deleteAdviceRun,
  loadAdviceRuns,
} from "../../services/history-store";

type HistoryRunView = StoredAdviceRun & {
  dateLabel: string;
};

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${month}.${day} ${hour}:${minute}`;
}

Page({
  data: {
    runs: [] as HistoryRunView[],
    expandedId: "",
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    this.setData({
      runs: loadAdviceRuns().map((run) => ({
        ...run,
        dateLabel: formatDate(run.createdAt),
      })),
    });
  },

  onToggle(event: {
    currentTarget: { dataset: { id?: string } };
  }) {
    const id = event.currentTarget.dataset.id ?? "";
    this.setData({ expandedId: this.data.expandedId === id ? "" : id });
  },

  onDelete(event: {
    currentTarget: { dataset: { id?: string } };
  }) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    wx.showModal({
      title: "删除这条记录？",
      content: "删除后无法恢复，服务端没有备份。",
      confirmColor: "#b98a48",
      success: (result) => {
        if (!result.confirm) return;
        deleteAdviceRun(id);
        this.refresh();
      },
    });
  },

  onClear() {
    wx.showModal({
      title: "清空全部本地记录？",
      content: "这会删除当前设备上的所有问题和判断卡，无法恢复。",
      confirmColor: "#a85f52",
      success: (result) => {
        if (!result.confirm) return;
        clearAdviceRuns();
        this.setData({ runs: [], expandedId: "" });
      },
    });
  },
});

