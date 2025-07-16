// server.js (最終修正版)

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

const CONFIG = {
    // 從平台的環境變數讀取 API_KEY，如果找不到，則使用一個預設值（防止本地運行出錯）
    apiKey: process.env.API_KEY || '5f6ae886937e991b9eb8c222',
    spread: 0.5,
    fee: 50,
    taxRate: 0.01
};

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/rate', async (req, res) => {
    try {
        const rateResponse = await fetch(`https://v6.exchangerate-api.com/v6/${CONFIG.apiKey}/latest/HKD`);
        if (!rateResponse.ok) throw new Error('獲取外部匯率失敗');
        const rateData = await rateResponse.json();
        if (rateData.result !== 'success') throw new Error(rateData['error-type']);
        const apiRate = rateData.conversion_rates.TWD;
        const quoteRate = apiRate + CONFIG.spread;
        res.json({ quoteRate, apiRate, lastUpdated: new Date(rateData.time_last_update_unix * 1000) });
    } catch (error) {
        console.error('[GET /api/rate] Error:', error);
        res.status(500).json({ error: '伺服器獲取匯率時發生錯誤' });
    }
});

app.post('/api/calculate', async (req, res) => {
    try {
        const { amount, direction } = req.body;
        if (amount === undefined || !direction) return res.status(400).json({ error: '缺少參數' });
        
        // 為了確保計算時也是最新匯率，再次獲取
        const rateResponse = await fetch(`https://v6.exchangerate-api.com/v6/${CONFIG.apiKey}/latest/HKD`);
        if (!rateResponse.ok) throw new Error('獲取外部匯率失敗');
        const rateData = await rateResponse.json();
        const apiRate = rateData.conversion_rates.TWD;
        const finalRate = apiRate + CONFIG.spread;

        let finalTwd = 0, finalHkd = 0, baseTwd = 0;
        if (direction === 'hkdToTwd') {
            finalHkd = parseFloat(amount);
            baseTwd = finalHkd * finalRate;
            finalTwd = Math.ceil(baseTwd + CONFIG.fee + (baseTwd + CONFIG.fee) * CONFIG.taxRate);
        } else {
            finalTwd = parseFloat(amount);
            const subtotalBeforeTax = finalTwd / (1 + CONFIG.taxRate);
            baseTwd = subtotalBeforeTax - CONFIG.fee;
            finalHkd = Math.floor(baseTwd / finalRate);
        }
        res.json({ finalTwd, finalHkd, baseTwd: Math.round(baseTwd), fee: CONFIG.fee, tax: Math.ceil((baseTwd + CONFIG.fee) * CONFIG.taxRate), quoteRate: finalRate, apiRate, lastUpdated: new Date(rateData.time_last_update_unix * 1000) });
    } catch (error) {
        console.error('[POST /api/calculate] Error:', error);
        res.status(500).json({ error: '伺服器計算時發生錯誤' });
    }
});

app.listen(PORT, () => {
    console.log(`\n伺服器已成功啟動！`);
    console.log(`✅ 請在您的瀏覽器中打開這個網址: http://localhost:${PORT}`);
    console.log(`(請保持這個終端機視窗開啟，以維持伺服器運行)`);
});
