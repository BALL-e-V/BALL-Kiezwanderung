import { jsPDF } from "jspdf";
import { wanderwegeConfig } from "$lib/config";

const { print: printConfig } = wanderwegeConfig;

export type PrintLayout = {
  doc: jsPDF;
  pageLeftMargin: number;
  pageTopMargin: number;
  imgX: number;
  imgY: number;
  imgW: number;
  imgH: number;
  textX: number;
  textY: number;
  textWidth: number;
  pageWidth: number;
  pageHeight: number;
};

export function createPrintLayout(trailBoundsRatio: number): PrintLayout {
  let doc: jsPDF;
  let pageLeftMargin = 5;
  let pageTopMargin = 5;
  let imgX = pageLeftMargin;
  let imgY = pageTopMargin;
  let imgW = 100;
  let imgH = 287;
  let textX = pageLeftMargin;
  let textY = pageTopMargin;
  let textWidth = 190;
  let pageWidth = 210;
  let pageHeight = 297;

  if (trailBoundsRatio < 0.3) {
    doc = new jsPDF({ unit: "mm", hotfixes: ["px_scaling"] });
    pageWidth = doc.internal.pageSize.getWidth();
    pageHeight = doc.internal.pageSize.getHeight();
    pageLeftMargin = 20;
    pageTopMargin = 5;
    imgX = pageLeftMargin;
    imgY = pageTopMargin;
    textX = imgX + imgW + 5;
    textY = imgY;
    textWidth = Math.max(50, pageWidth - textX - 5);
  } else if (trailBoundsRatio < 1) {
    doc = new jsPDF({ orientation: "l", unit: "mm", hotfixes: ["px_scaling"] });
    pageWidth = doc.internal.pageSize.getWidth();
    pageHeight = doc.internal.pageSize.getHeight();
    pageLeftMargin = 5;
    pageTopMargin = 20;
    imgX = pageLeftMargin;
    imgY = pageTopMargin;
    imgW = 140;
    imgH = 185;
    textX = imgX + imgW + 5;
    textY = imgY;
    textWidth = Math.max(50, pageWidth - textX - 5);
  } else if (trailBoundsRatio < 3) {
    doc = new jsPDF({ unit: "mm", hotfixes: ["px_scaling"] });
    pageWidth = doc.internal.pageSize.getWidth();
    pageHeight = doc.internal.pageSize.getHeight();
    pageLeftMargin = 20;
    pageTopMargin = 5;
    imgX = pageLeftMargin;
    imgY = pageTopMargin;
    imgW = 185;
    imgH = 140;
    textX = pageLeftMargin;
    textY = imgY + imgH + printConfig.margins.mapContent;
    textWidth = pageWidth - pageLeftMargin * 2;
  } else {
    doc = new jsPDF({ orientation: "l", unit: "mm", hotfixes: ["px_scaling"] });
    pageWidth = doc.internal.pageSize.getWidth();
    pageHeight = doc.internal.pageSize.getHeight();
    pageLeftMargin = 5;
    pageTopMargin = 20;
    imgX = pageLeftMargin;
    imgY = pageTopMargin;
    imgW = 287;
    imgH = 100;
    textX = pageLeftMargin;
    textY = imgY + imgH + printConfig.margins.mapContent;
    textWidth = pageWidth - pageLeftMargin * 2;
  }

  return {
    doc,
    pageLeftMargin,
    pageTopMargin,
    imgX,
    imgY,
    imgW,
    imgH,
    textX,
    textY,
    textWidth,
    pageWidth,
    pageHeight,
  };
}
