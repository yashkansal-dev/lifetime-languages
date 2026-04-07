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

    const sorted = Object.entries(languageData)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const total = sorted.reduce((sum, item) => sum + item[1], 0);

    const rawData = sorted.map(([lang, value]) => ({
      lang,
      percent: total > 0 ? (value / total) * 100 : 0
    }));

    const normalizedTotal = rawData.reduce((sum, item) => sum + item.percent, 0);
    const data = rawData.map((item, index) => {
      if (normalizedTotal === 0) {
        return { ...item, percent: 0 };
      }

      if (index === rawData.length - 1) {
        const used = rawData
          .slice(0, index)
          .reduce((sum, d) => sum + (d.percent / normalizedTotal) * 100, 0);
        return { ...item, percent: Math.max(0, 100 - used) };
      }

      return { ...item, percent: (item.percent / normalizedTotal) * 100 };
    });

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
    let stackX = stackLeft;
    const stackY = 380;
    const stackWidth = width - (stackLeft * 2);

    data.forEach((item, index) => {
      const color = COLORS[item.lang] || COLORS.default;
      const widthPart = index === data.length - 1
        ? (stackLeft + stackWidth) - stackX
        : (item.percent / 100) * stackWidth;

      ctx.fillStyle = color;
      ctx.fillRect(stackX, stackY, widthPart, 20);

      stackX += widthPart;
    });

    ctx.strokeStyle = "#30363d";
    ctx.strokeRect(stackLeft, stackY, stackWidth, 20);

    // ----------- LEGEND -----------

    let legendX = 60;
    let legendY = 430;

    data.forEach(item => {
      const color = COLORS[item.lang] || COLORS.default;

      // dot
      ctx.beginPath();
      ctx.arc(legendX, legendY, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // text
      ctx.fillStyle = "#c9d1d9";
      ctx.font = "14px Inter";
      ctx.fillText(
        `${item.lang}`,
        legendX + 12,
        legendY + 4
      );

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