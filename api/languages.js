import axios from "axios";
import { createCanvas } from "canvas";

const COLORS = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
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

    const data = sorted.map(([lang, value]) => ({
      lang,
      percent: (value / total) * 100
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
    ctx.font = "bold 28px Arial";
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
      ctx.font = "14px Arial";
      ctx.fillText(item.percent.toFixed(1) + "%", x, baseY - heightScale - 10);

      // label
      ctx.fillStyle = "#c9d1d9";
      ctx.fillText(item.lang, x - 5, baseY + 20);

      x += barWidth + gap;
    });

    // ----------- STACKED BAR -----------

    let stackX = 60;
    const stackY = 380;
    const stackWidth = 780;

    data.forEach(item => {
      const color = COLORS[item.lang] || COLORS.default;
      const widthPart = (item.percent / 100) * stackWidth;

      ctx.fillStyle = color;
      ctx.fillRect(stackX, stackY, widthPart, 20);

      stackX += widthPart;
    });

    ctx.strokeStyle = "#30363d";
    ctx.strokeRect(60, stackY, stackWidth, 20);

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
      ctx.font = "14px Arial";
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