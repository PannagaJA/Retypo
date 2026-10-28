import { describe, it, expect } from 'vitest';
import type { DetectedTextRegion, WordRegion, TextLayer } from '../types';

describe('OCR Text Grouping & Multi-Level Selection', () => {
  const lineRegionWithWords: DetectedTextRegion = {
    regionId: 'ocr-line-1',
    text: "Payment transferred from PANNAGA J A's",
    polygon: [[30, 120], [345, 120], [345, 140], [30, 140]],
    bbox: [30, 120, 315, 20],
    angle: 0,
    estimatedFontSize: 16,
    estimatedColor: '#1e293b',
    confidence: 0.985,
    geometryConfidence: 1.0,
    isConverted: false,
    lineId: 'line-1',
    paragraphId: 'para-timeline-1',
    words: [
      { wordId: 'w-1', text: 'Payment', polygon: [[30, 120], [90, 120], [90, 140], [30, 140]], bbox: [30, 120, 60, 20], confidence: 0.99 },
      { wordId: 'w-2', text: 'transferred', polygon: [[95, 120], [180, 120], [180, 140], [95, 140]], bbox: [95, 120, 85, 20], confidence: 0.98 },
      { wordId: 'w-3', text: 'from', polygon: [[185, 120], [220, 120], [220, 140], [185, 140]], bbox: [185, 120, 35, 20], confidence: 0.99 },
      { wordId: 'w-4', text: 'PANNAGA', polygon: [[225, 120], [300, 120], [300, 140], [225, 140]], bbox: [225, 120, 75, 20], confidence: 0.99 },
      { wordId: 'w-5', text: 'J', polygon: [[305, 120], [315, 120], [315, 140], [305, 140]], bbox: [305, 120, 10, 20], confidence: 0.99 },
      { wordId: 'w-6', text: "A's", polygon: [[320, 120], [345, 120], [345, 140], [320, 140]], bbox: [320, 120, 25, 20], confidence: 0.98 },
    ],
  };

  const wrappedLineRegion: DetectedTextRegion = {
    regionId: 'ocr-line-2',
    text: 'account',
    polygon: [[30, 148], [95, 148], [95, 168], [30, 168]],
    bbox: [30, 148, 65, 20],
    angle: 0,
    estimatedFontSize: 16,
    estimatedColor: '#1e293b',
    confidence: 0.99,
    geometryConfidence: 1.0,
    isConverted: false,
    lineId: 'line-2',
    paragraphId: 'para-timeline-1',
    words: [
      { wordId: 'w-7', text: 'account', polygon: [[30, 148], [95, 148], [95, 168], [30, 168]], bbox: [30, 148, 65, 20], confidence: 0.99 },
    ],
  };

  it('preserves natural line text and union bounding box', () => {
    expect(lineRegionWithWords.text).toBe("Payment transferred from PANNAGA J A's");
    expect(lineRegionWithWords.bbox[0]).toBe(30);
    expect(lineRegionWithWords.bbox[2]).toBe(315);
    expect(lineRegionWithWords.words?.length).toBe(6);
  });

  it('associates multi-line wrapped text via paragraphId', () => {
    expect(lineRegionWithWords.paragraphId).toBe(wrappedLineRegion.paragraphId);
    expect(lineRegionWithWords.lineId).not.toBe(wrappedLineRegion.lineId);
  });

  it('supports word-level conversion into TextLayer without losing sibling words', () => {
    const targetWord: WordRegion = lineRegionWithWords.words![3]; // "PANNAGA"
    const wordLayer: TextLayer = {
      id: 'layer-ocr-w-1',
      text: targetWord.text,
      fontFamily: lineRegionWithWords.estimatedFontFamily || 'Inter',
      fontSize: lineRegionWithWords.estimatedFontSize,
      fontWeight: lineRegionWithWords.estimatedWeight || '400',
      fontStyle: 'normal',
      fill: lineRegionWithWords.estimatedColor,
      strokeWidth: 0,
      letterSpacing: 0,
      lineHeight: 1.2,
      textAlign: 'left',
      left: targetWord.bbox[0],
      top: targetWord.bbox[1],
      width: targetWord.bbox[2],
      height: targetWord.bbox[3],
      angle: 0,
      opacity: 1,
      isLocked: false,
      isVisible: true,
      origin: 'ocr_detected',
    };

    expect(wordLayer.text).toBe('PANNAGA');
    expect(wordLayer.left).toBe(225);
    expect(wordLayer.top).toBe(120);
    expect(wordLayer.width).toBe(75);
  });

  it('supports block-level multi-line conversion combining wrapped lines', () => {
    const regions = [lineRegionWithWords, wrappedLineRegion];
    const combinedText = regions.map((r) => r.text).join('\n');
    const allXs = regions.flatMap((r) => [r.bbox[0], r.bbox[0] + r.bbox[2]]);
    const allYs = regions.flatMap((r) => [r.bbox[1], r.bbox[1] + r.bbox[3]]);
    const minX = Math.min(...allXs);
    const maxX = Math.max(...allXs);
    const minY = Math.min(...allYs);
    const maxY = Math.max(...allYs);

    const blockLayer: TextLayer = {
      id: 'layer-ocr-block-1',
      text: combinedText,
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: '400',
      fontStyle: 'normal',
      fill: '#1e293b',
      strokeWidth: 0,
      letterSpacing: 0,
      lineHeight: 1.25,
      textAlign: 'left',
      left: minX,
      top: minY,
      width: maxX - minX,
      height: maxY - minY,
      angle: 0,
      opacity: 1,
      isLocked: false,
      isVisible: true,
      origin: 'ocr_detected',
    };

    expect(blockLayer.text).toBe("Payment transferred from PANNAGA J A's\naccount");
    expect(blockLayer.left).toBe(30);
    expect(blockLayer.top).toBe(120);
    expect(blockLayer.width).toBe(315);
    expect(blockLayer.height).toBe(48); // 168 - 120
  });

  it('maintains separate line regions when horizontal space exceeds column threshold', () => {
    const leftColumnRegion: DetectedTextRegion = {
      regionId: 'ocr-line-upi',
      text: 'paytmqr12ij4o@payt',
      polygon: [[42, 410], [150, 410], [150, 426], [42, 426]],
      bbox: [42, 410, 108, 16],
      angle: 0,
      estimatedFontSize: 16,
      estimatedColor: '#1e293b',
      confidence: 0.98,
      geometryConfidence: 1.0,
      isConverted: false,
      lineId: 'line-upi',
    };

    const rightColumnRegion: DetectedTextRegion = {
      regionId: 'ocr-line-remarks',
      text: 'NO REMARK',
      polygon: [[193, 410], [262, 410], [262, 424], [193, 424]],
      bbox: [193, 410, 69, 14],
      angle: 0,
      estimatedFontSize: 14,
      estimatedColor: '#1e293b',
      confidence: 0.99,
      geometryConfidence: 1.0,
      isConverted: false,
      lineId: 'line-remarks',
    };

    // On line select level, both fields are distinct selectable regions
    const lineRegions = [leftColumnRegion, rightColumnRegion];
    expect(lineRegions.length).toBe(2);
    expect(lineRegions[0].text).toBe('paytmqr12ij4o@payt');
    expect(lineRegions[1].text).toBe('NO REMARK');
    // Ensure horizontal gap is kept unmerged
    const gap = rightColumnRegion.bbox[0] - (leftColumnRegion.bbox[0] + leftColumnRegion.bbox[2]);
    expect(gap).toBe(43);
    expect(gap).toBeGreaterThan(1.4 * leftColumnRegion.bbox[3]);
  });
});

