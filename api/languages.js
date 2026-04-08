import axios from "axios";
import { existsSync } from "fs";
import path from "path";
import { createCanvas, registerFont } from "canvas";

const fontPath = path.join(process.cwd(), "fonts", "Inter_18pt-Regular.ttf");

if (existsSync(fontPath)) {
  registerFont(fontPath, {
    family: "Inter"
  });
}

const COLORS = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#39ff14",
  Java: "#b07219",
  Kotlin: "#A97BFF",
  Swift: "#ffac45",
  HTML: "#e34c26",
  CSS: "#563d7c",
  default: "#58a6ff"
};

const STACK_MIN_VISUAL_WIDTH = 3;
const OTHERS_COLOR = "#f21aca";

export default async function handler(req, res) {
  try {
    const token = process.env.GITHUB_TOKEN;

    const repoRes = await axios.get(
      `https://api.github.com/user/repos?per_page=100&type=all`,
      { headers: { Authorization: `token ${token}` } }
    );

    let languageData = {};

    for (let repo of repoRes.data) {
      const langRes = await axios.get(repo.languages_url, {
        headers: { Authorization: `token ${token}` }
      });

      for (let lang in langRes.data) {
        languageData[lang] = (languageData[lang] || 0) + langRes.data[lang];
      }
    }

    const total = Object.values(languageData).reduce((sum, value) => sum + value, 0);
    const topLanguages = Object.entries(languageData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const rawData = topLanguages.map(([lang, value]) => ({
      lang,
      value,
      percent: total > 0 ? (value / total) * 100 : 0
    }));

    const rawTotal = rawData.reduce((sum, item) => sum + item.percent, 0);
    const baseData = rawTotal < 100 && total > 0
      ? [...rawData, { lang: "Others", percent: 100 - rawTotal }]
      : rawData;

    const normalizedData = rawTotal > 100 && rawTotal > 0
      ? baseData.map(item => ({
          ...item,
          percent: (item.percent / rawTotal) * 100
        }))
      : baseData;

    const data = normalizedData.map((item, index) => ({
      ...item,
      isFirst: index === 0,
      isLast: index === normalizedData.length - 1
    }));

    // 🎨 Canvas
    const width = 900;
    const height = 550;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#fff";
    ctx.font = "20px Inter";
    ctx.fillText("Tech Stack Analytics", 40, 50);

    // ----------- ROUNDED VERTICAL BARS -----------

    const barWidth = 60;
    const gap = 40;
    let x = 60;
    const baseY = 300;

    data.forEach(item => {
      const heightScale = item.percent * 2;
      const color = COLORS[item.lang] || COLORS.default;

      drawRoundedRect(
        ctx,
        x,
        baseY - heightScale,
        barWidth,
        heightScale,
        10,
        color
      );

      // % text
      ctx.fillStyle = "#fff";
      ctx.font = "14px Inter";
      ctx.fillText(item.percent.toFixed(1) + "%", x, baseY - heightScale - 10);

      // label
      ctx.fillStyle = "#c9d1d9";
      ctx.fillText(item.lang, x - 5, baseY + 20);

      x += barWidth + gap;
    });

    // ----------- STACKED BAR -----------

    const stackLeft = 60;
    const stackY = 380;
    const stackWidth = width - (stackLeft * 2);

    const stackSegments = buildStackSegments(data, stackWidth);
    let stackX = stackLeft;

    stackSegments.forEach(segment => {
      const color = segment.lang === "Others"
        ? OTHERS_COLOR
        : (COLORS[segment.lang] || COLORS.default);

      drawSegmentRect(
        ctx,
        stackX,
        stackY,
        segment.width,
        20,
        10,
        color,
        segment.isFirst,
        segment.isLast
      );

      stackX += segment.width;
    });

    ctx.strokeStyle = "#30363d";
    ctx.strokeRect(stackLeft, stackY, stackWidth, 20);

    // ----------- LEGEND -----------

    let legendX = 60;
    let legendY = 430;

    data.forEach(item => {
      const color = item.lang === "Others"
        ? OTHERS_COLOR
        : (COLORS[item.lang] || COLORS.default);

      // dot
      ctx.beginPath();
      ctx.arc(legendX, legendY, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // text
      ctx.fillStyle = "#c9d1d9";
      ctx.font = "14px Inter";
      ctx.textBaseline = "middle";
      ctx.fillText(`${item.lang}`, legendX + 12, legendY);
      ctx.textBaseline = "alphabetic";

      legendX += 130;
      if (legendX > 750) {
        legendX = 60;
        legendY += 30;
      }
    });

    const buffer = canvas.toBuffer("image/png");

    res.setHeader("Content-Type", "image/png");
    res.send(buffer);

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Error generating stats");
  }
}

function drawRoundedRect(ctx, x, y, width, height, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

function buildStackSegments(data, stackWidth) {
  const totalPercent = data.reduce((sum, item) => sum + item.percent, 0);

  if (data.length === 0 || stackWidth <= 0 || totalPercent <= 0) {
    return [{ lang: "Others", width: stackWidth, isFirst: true, isLast: true }];
  }

  const exactWidths = data.map(item => (item.percent / totalPercent) * stackWidth);
  const lastIndex = data.length - 1;
  const lastDesiredWidth = Math.max(
    data[lastIndex].percent > 0 ? STACK_MIN_VISUAL_WIDTH : 0,
    Math.round(exactWidths[lastIndex])
  );

  const previousData = data.slice(0, lastIndex);
  const previousExactWidths = exactWidths.slice(0, lastIndex);
  const previousSegments = allocateSegmentWidths(previousData, previousExactWidths, stackWidth - lastDesiredWidth);

  return [
    ...previousSegments.map((segment, index) => ({
      lang: segment.lang,
      width: segment.width,
      isFirst: index === 0,
      isLast: false
    })),
    {
      lang: data[lastIndex].lang,
      width: Math.max(0, stackWidth - previousSegments.reduce((sum, segment) => sum + segment.width, 0)),
      isFirst: data.length === 1,
      isLast: true
    }
  ];
}

function allocateSegmentWidths(data, exactWidths, totalWidth) {
  if (data.length === 0 || totalWidth <= 0) {
    return [];
  }

  const locked = exactWidths.map(width => width > 0 && width < STACK_MIN_VISUAL_WIDTH);
  const lockedTotal = locked.reduce((sum, isLocked) => sum + (isLocked ? STACK_MIN_VISUAL_WIDTH : 0), 0);
  const flexibleTotal = exactWidths.reduce((sum, width, index) => sum + (locked[index] ? 0 : width), 0);

  if (lockedTotal > totalWidth || flexibleTotal <= 0) {
    const baseWidth = totalWidth / data.length;
    let usedWidth = 0;

    return data.map((item, index) => {
      const isLast = index === data.length - 1;
      const width = isLast
        ? Math.max(0, totalWidth - usedWidth)
        : Math.max(0, Math.round(baseWidth));

      usedWidth += width;

      return { lang: item.lang, width };
    });
  }

  const targetWidths = exactWidths.map((width, index) => {
    if (locked[index]) {
      return STACK_MIN_VISUAL_WIDTH;
    }

    return (width / flexibleTotal) * (totalWidth - lockedTotal);
  });

  const floorWidths = targetWidths.map(width => Math.floor(width));
  let remaining = totalWidth - floorWidths.reduce((sum, width) => sum + width, 0);

  const fractions = targetWidths.map((width, index) => ({
    index,
    fraction: width - floorWidths[index]
  }))
    .sort((a, b) => b.fraction - a.fraction);

  for (const entry of fractions) {
    if (remaining <= 0) {
      break;
    }

    floorWidths[entry.index] += 1;
    remaining -= 1;
  }

  let usedWidth = 0;

  return data.map((item, index) => {
    const isLast = index === data.length - 1;
    const width = isLast
      ? Math.max(0, totalWidth - usedWidth)
      : floorWidths[index];

    usedWidth += width;

    return { lang: item.lang, width };
  });
}

function drawSegmentRect(ctx, x, y, width, height, radius, color, isFirst, isLast) {
  const safeRadius = Math.min(radius, height / 2, width / 2);

  ctx.fillStyle = color;
  ctx.beginPath();

  if (isFirst && isLast) {
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  } else if (isFirst) {
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  } else if (isLast) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x, y + height);
  } else {
    ctx.rect(x, y, width, height);
  }

  ctx.closePath();
  ctx.fill();
}