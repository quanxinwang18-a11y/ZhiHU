import type { StoredAdviceRun } from "../../domain/advice";
import {
  clearAdviceRuns,
  deleteAdviceRun,
  loadAdviceRuns,
} from "../../services/history-store";
import {
  fallbackSpectrumFromText,
  historySpectrumStyle,
  isSpectrumId,
} from "../../domain/visual-spectrum";

type HistoryRunView = StoredAdviceRun & {
  dateLabel: string;
  spectrumStyle: string;
};

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hour = `${date.getHours()}`.padStart(2, "0");
  const minute = `${date.getMinutes()}`.padStart(2, "0");
  return `${month}.${day} ${hour}:${minute}`;
}

let deleteConfirmTimer: ReturnType<typeof setTimeout> | null = null;
let clearConfirmTimer: ReturnType<typeof setTimeout> | null = null;

Page({
  data: {
    statusBarHeight: 20,
    runs: [] as HistoryRunView[],
    expandedId: "",
    deleteConfirmId: "",
    clearConfirming: false,
  },

  onUnload() {
    if (deleteConfirmTimer) clearTimeout(deleteConfirmTimer);
    if (clearConfirmTimer) clearTimeout(clearConfirmTimer);
    deleteConfirmTimer = null;
    clearConfirmTimer = null;
  },

  onShow() {
    try {
      this.setData({ statusBarHeight: wx.getWindowInfo().statusBarHeight });
    } catch {
      this.setData({ statusBarHeight: 20 });
    }
    this.refresh();
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  },

  refresh() {
    this.setData({
      runs: loadAdviceRuns().map((run) => ({
        ...run,
        dateLabel: formatDate(run.createdAt),
        spectrumStyle: historySpectrumStyle(
          isSpectrumId(run.spectrumId)
            ? run.spectrumId
            : fallbackSpectrumFromText(run.question),
        ),
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
    if (this.data.deleteConfirmId !== id) {
      if (deleteConfirmTimer) clearTimeout(deleteConfirmTimer);
      this.setData({ deleteConfirmId: id });
      deleteConfirmTimer = setTimeout(() => {
        deleteConfirmTimer = null;
        this.setData({ deleteConfirmId: "" });
      }, 3000);
      return;
    }
    if (deleteConfirmTimer) clearTimeout(deleteConfirmTimer);
    deleteConfirmTimer = null;
    deleteAdviceRun(id);
    this.setData({ deleteConfirmId: "" });
    this.refresh();
  },

  onClear() {
    if (!this.data.clearConfirming) {
      if (clearConfirmTimer) clearTimeout(clearConfirmTimer);
      this.setData({ clearConfirming: true });
      clearConfirmTimer = setTimeout(() => {
        clearConfirmTimer = null;
        this.setData({ clearConfirming: false });
      }, 3000);
      return;
    }
    if (clearConfirmTimer) clearTimeout(clearConfirmTimer);
    clearConfirmTimer = null;
    clearAdviceRuns();
    this.setData({
      runs: [],
      expandedId: "",
      clearConfirming: false,
      deleteConfirmId: "",
    });
  },
});
