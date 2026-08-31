const { v4: uuidv4 } = require('uuid');

const MONTHS = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};

function stripEmojis(text) {
  if (!text) return '';
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
    .replace(/[\u{E0000}-\u{E007F}]/gu, '')
    .replace(/[\u200D]/g, '')
    .replace(/[\uFE0F]/g, '')
    .replace(/[\u20E3]/g, '')
    .replace(/[^\x20-\x7E\u00C0-\u024F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanMerchant(raw) {
  let name = raw.trim();
  name = name.replace(/^(Paid to|Received from|Refund from)\s*/i, '');
  name = name.replace(/^for\s+/i, '');
  name = name.replace(/\s+(DEBIT|CREDIT)$/i, '');
  name = name.trim();
  // Title case
  name = name.split(' ').map(w => w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '').join(' ');
  return name || 'Unknown Merchant';
}

function normalizeMerchant(displayName) {
  return displayName.toLowerCase()
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
    .replace(/[^a-z0-9]/g, '')
    .trim() || 'unknown';
}

function parseAmount(str) {
  const cleaned = str.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

// Pass 1: Primary Desktop PhonePe Parser (Untouched)
function parseDesktopPhonePe(rawText) {
  let cleaned = rawText;
  cleaned = cleaned.replace(/Page\s+\d+\s+of\s+\d+/gi, '');
  cleaned = cleaned.replace(/Date\s+Transaction\s+Details\s+Type\s+Amount/gi, '');
  cleaned = cleaned.replace(/This\s+is\s+a\s+system\s+generated\s+statement\./gi, '');
  cleaned = cleaned.replace(/For\s+any\s+queries,?\s+contact\s+us\s+at\s+https?:\/\/[^\s\n]*/gi, '');
  cleaned = cleaned.replace(/https?:\/\/support\.phonepe\.com[^\s\n]*/gi, '');
  cleaned = cleaned.replace(/https?:\/\/www\.phonepe\.com[^\s\n]*/gi, '');
  cleaned = cleaned.replace(/This\s+is\s+an\s+automatically\s+generated\s+statement[\s\S]*?Privacy\s+Policy\./gi, '');
  cleaned = cleaned.replace(/Customer\(s\)\s+are\s+requested[\s\S]*?Privacy\s+Policy\./gi, '');
  cleaned = cleaned.replace(/Disclaimer\s*:[\s\S]*?details are corrected\./gi, '');
  cleaned = cleaned.replace(/Do\s+not\s+fall\s+prey[\s\S]*?details are corrected\./gi, '');
  cleaned = cleaned.replace(/Datetransaction\s*Detailstypeamount/gi, '');
  cleaned = cleaned.replace(/DateTransaction\s*DetailsTypeAmount/gi, '');
  cleaned = cleaned.replace(/Athttps?:\/\/[^\s\n]*/gi, '');
  cleaned = cleaned.replace(/Athttp[^\s\n]*/gi, '');
  cleaned = cleaned.replace(/Transaction\s+Statement\s+for\s+\d+/gi, '');
  cleaned = cleaned.replace(/\d{1,2}\s+\w+,\s+\d{4}\s*-\s*\d{1,2}\s+\w+,\s+\d{4}/g, '');

  const flat = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\s{2,}/g, ' ');

  const transactions = [];
  const MASTER_REGEX = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}:\d{2}\s+(?:am|pm))\s+(DEBIT|CREDIT)\s*(?:Γé╣|₹|INR|Rs\.?)\s*([\d,]+(?:\.\d{1,2})?)\s*(Paid to|Received from|Refund from)\s+([^Γé╣₹]+?)(?=\s+(?:DEBIT|CREDIT)\s*(?:Γé╣|₹|INR|Rs\.?)|\s+Transaction ID|\s+UTR No|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}|$)/gi;

  let match;
  while ((match = MASTER_REGEX.exec(flat)) !== null) {
    const monthStr = match[1].toLowerCase();
    const month = MONTHS[monthStr];
    let dateObj = new Date(parseInt(match[3]), month, parseInt(match[2]));
    dateObj = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000));
    
    const timeStr = match[4];
    const type = match[5].toLowerCase();
    const amount = parseAmount(match[6]);
    let rawMerchantName = match[8].trim();
    
    let cleanedRaw = stripEmojis(rawMerchantName);
    let merchantClean = cleanedRaw.replace(/\s*(Paid by|Credited to)\s+[A-Z0-9X]+/i, '').replace(/\s+/g, ' ').trim();
    merchantClean = cleanMerchant(merchantClean);

    if (amount <= 0 || merchantClean.length < 2) continue;

    const afterMatch = flat.substring(MASTER_REGEX.lastIndex);
    const nextDatePos = afterMatch.search(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s+\d{4}/i);
    const segment = nextDatePos > 0 ? afterMatch.substring(0, nextDatePos) : afterMatch.substring(0, 300);

    const utrMatch = segment.match(/UTR No\.?\s*(\d+)/i);
    const txnIdMatch = segment.match(/Transaction ID\s+([A-Z0-9]+)/i);

    transactions.push({
      id: uuidv4(),
      date: dateObj.toISOString().split('T')[0],
      time: timeStr,
      merchant: merchantClean,
      rawMerchant: rawMerchantName,
      normalizedMerchant: normalizeMerchant(merchantClean),
      amount: amount,
      type: type,
      category: 'Uncategorized',
      upiRef: utrMatch ? utrMatch[1] : null,
      transactionId: txnIdMatch ? txnIdMatch[1] : null,
      status: 'Success',
      uploadedAt: new Date().toISOString()
    });
  }

  return transactions;
}

// Pass 2: Mobile Fallback PhonePe Parser
function parseMobilePhonePe(rawText) {
  let cleaned = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);

  const ignoredLines = [
    /^DateTransaction\s*DetailsTypeAmount$/i,
    /^Datetransaction\s*Detailstypeamount$/i,
    /^Date\s+Transaction\s+Details\s+Type\s+Amount$/i,
    /^Transaction\s+Statement\s+for\s+\d+$/i,
    /^\d{1,2}\s+\w+,\s+\d{4}\s*-\s*\d{1,2}\s+\w+,\s+\d{4}$/i,
    /^This\s+is\s+a\s+system\s+generated\s+statement\./i,
    /^Page\s+\d+\s+of\s+\d+$/i,
    /^For\s+any\s+queries,?\s+contact/i,
    /^https?:\/\//i,
    /^Customer\(s\)\s+are\s+requested/i,
    /^Disclaimer\s*:/i,
    /^Do\s+not\s+fall\s+prey/i
  ];

  const filteredLines = lines.filter(line => {
    return !ignoredLines.some(re => re.test(line));
  });

  const blocks = [];
  let currentBlock = null;

  const dateRegex = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})$/i;

  for (let i = 0; i < filteredLines.length; i++) {
    const line = filteredLines[i];
    if (dateRegex.test(line)) {
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = [line];
    } else if (currentBlock) {
      currentBlock.push(line);
    }
  }
  if (currentBlock) {
    blocks.push(currentBlock);
  }

  const transactions = [];

  for (const block of blocks) {
    try {
      const blockText = block.join(' ');
      const dateLine = block.find(l => dateRegex.test(l));
      if (!dateLine) continue;

      const dateMatch = dateLine.match(dateRegex);
      const monthStr = dateMatch[1].toLowerCase();
      const month = MONTHS[monthStr];
      const day = parseInt(dateMatch[2]);
      const year = parseInt(dateMatch[3]);
      let dateObj = new Date(year, month, day);
      dateObj = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000));
      const formattedDate = dateObj.toISOString().split('T')[0];

      const timeLine = block.find(l => /(\d{1,2})[\s:]+(\d{2})\s*(am|pm)/i.test(l));
      let timeStr = '';
      if (timeLine) {
        const timeMatch = timeLine.match(/(\d{1,2})[\s:]+(\d{2})\s*(am|pm)/i);
        if (timeMatch) {
          const hh = timeMatch[1].padStart(2, '0');
          const mm = timeMatch[2];
          const ampm = timeMatch[3].toLowerCase();
          timeStr = `${hh}:${mm} ${ampm}`;
        }
      }

      const mainLine = block.find(l => /(DEBIT|CREDIT)/i.test(l));
      if (!mainLine) continue;

      const mainMatch = mainLine.match(/(DEBIT|CREDIT)\s*(?:Γé╣|₹|INR|Rs\.?)?\s*([\d,]+(?:\.\d{1,2})?)\s*(Paid to|Received from|Refund from)?\s*(.+)/i);
      if (!mainMatch) continue;

      const type = mainMatch[1].toLowerCase();
      const amount = parseAmount(mainMatch[2]);
      let rawMerchant = mainMatch[4].trim();

      let cleanedRaw = stripEmojis(rawMerchant);
      let merchantClean = cleanedRaw.replace(/\s*(Paid by|Credited to)\s+[A-Z0-9X]+/i, '').replace(/\s+/g, ' ').trim();
      merchantClean = cleanMerchant(merchantClean);

      if (amount <= 0 || merchantClean.length < 2) continue;

      const utrMatch = blockText.match(/UTR No\.?\s*:?\s*(\d+)/i);
      const txnIdMatch = blockText.match(/Transaction ID\s*:?\s*([A-Z0-9]+)/i);

      transactions.push({
        id: uuidv4(),
        date: formattedDate,
        time: timeStr,
        merchant: merchantClean,
        rawMerchant: rawMerchant,
        normalizedMerchant: normalizeMerchant(merchantClean),
        amount: amount,
        type: type,
        category: 'Uncategorized',
        upiRef: utrMatch ? utrMatch[1] : null,
        transactionId: txnIdMatch ? txnIdMatch[1] : null,
        status: 'Success',
        uploadedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Skipping block error:', err);
    }
  }

  return transactions;
}

function extractTransactions(rawText) {
  // Pass 1: Primary Desktop Parser (Untouched)
  let transactions = parseDesktopPhonePe(rawText);
  if (transactions.length > 0) {
    console.log(`[PhonePe Parser] Pass 1 (Desktop) extracted ${transactions.length} transactions.`);
    return transactions;
  }

  // Pass 2: Mobile Fallback Parser
  console.log('[PhonePe Parser] Pass 1 returned 0 transactions. Running Pass 2 (Mobile Fallback)...');
  transactions = parseMobilePhonePe(rawText);
  console.log(`[PhonePe Parser] Pass 2 (Mobile) extracted ${transactions.length} transactions.`);

  return transactions;
}

function parseGooglePay(rawText) {
  const cleanText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanText.split('\n').map(l => l.trim()).filter(Boolean);

  const txBlocks = [];
  let currentBlock = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isDate = /^\d{1,2}\s*[A-Za-z]+,\s*\d{4}$/.test(line);
    const isNextTime = i + 1 < lines.length && /^\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)$/i.test(lines[i + 1]);

    if (isDate && isNextTime) {
      if (currentBlock) {
        txBlocks.push(currentBlock);
      }
      currentBlock = [];
    }

    if (currentBlock) {
      currentBlock.push(line);
    }
  }
  if (currentBlock) {
    txBlocks.push(currentBlock);
  }

  const transactions = [];

  for (const block of txBlocks) {
    try {
      const dateLine = block.find(l => /^\d{1,2}\s*[A-Za-z]+,\s*\d{4}$/.test(l));
      const timeLine = block.find(l => /^\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)$/i.test(l));
      const merchantLine = block.find(l => /^(?:Paid\s*to|Received\s*from)/i.test(l));
      const txIdLine = block.find(l => /UPI\s*Transaction\s*ID\s*:/i.test(l));
      const accountLine = block.find(l => /^(?:Paid\s*by|Received\s*in|Deposit\s*to|Credited\s*to)/i.test(l));
      const amountLine = block.find(l => /(?:₹|Rs\.?|INR)\s*[\d,]+/i.test(l));

      if (!dateLine || !amountLine) {
        continue;
      }

      const dateMatch = dateLine.match(/^(\d{1,2})\s*([A-Za-z]+),\s*(\d{4})$/);
      if (!dateMatch) throw new Error("Invalid date format: " + dateLine);
      const day = parseInt(dateMatch[1]);
      const monthName = dateMatch[2].toLowerCase().substring(0, 3);
      const month = MONTHS[monthName];
      const year = parseInt(dateMatch[3]);
      if (isNaN(day) || month === undefined || isNaN(year)) {
        throw new Error(`Invalid date components: day=${day}, monthName=${monthName}, year=${year}`);
      }
      let dateObj = new Date(year, month, day);
      dateObj = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000));
      const formattedDate = dateObj.toISOString().split('T')[0];

      const time = timeLine ? timeLine.trim() : '';

      let rawMerchant = 'Unknown Merchant';
      let direction = 'debit';
      if (merchantLine) {
        if (/^Received\s*from/i.test(merchantLine)) {
          direction = 'credit';
          rawMerchant = merchantLine.replace(/^Received\s*from\s*/i, '').trim();
        } else {
          direction = 'debit';
          rawMerchant = merchantLine.replace(/^Paid\s*to\s*/i, '').trim();
        }
      }

      let upiTransactionId = null;
      if (txIdLine) {
        const txIdMatch = txIdLine.match(/UPI\s*Transaction\s*ID\s*:\s*(\d+)/i);
        if (txIdMatch) upiTransactionId = txIdMatch[1];
      }

      let paymentAccount = '';
      if (accountLine) {
        paymentAccount = accountLine.replace(/^(?:Paid\s*by|Received\s*in|Deposit\s*to|Credited\s*to)\s*/i, '').trim();
      }

      const amtMatch = amountLine.match(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d+)?)/i);
      if (!amtMatch) throw new Error("Amount match failed: " + amountLine);
      const amount = parseFloat(amtMatch[1].replace(/,/g, ''));

      const transactionType = direction === 'credit' ? 'CREDIT' : 'DEBIT';

      let merchantClean = stripEmojis(rawMerchant);
      merchantClean = cleanMerchant(merchantClean);

      transactions.push({
        id: uuidv4(),
        provider: "GPAY",
        date: formattedDate,
        time: time,
        merchant: merchantClean,
        normalizedMerchant: normalizeMerchant(merchantClean),
        amount: amount,
        transactionType,
        type: transactionType.toLowerCase(), // for pipeline compatibility
        transactionId: upiTransactionId,
        upiRef: null,
        utrNumber: null,
        paymentAccount,
        uploadedAt: new Date().toISOString(),
        status: 'Success'
      });
    } catch (err) {
      console.warn("Skipping GPay transaction due to parsing error:", err.message);
    }
  }

  return transactions;
}

function parsePaytm(rawText) {
  // Extract year from header
  const headerMatch = rawText.match(/(\d{1,2}\s+[A-Za-z]+'?\d{2,4})\s*-\s*(\d{1,2}\s+[A-Za-z]+'?\d{2,4})/i);
  let year = new Date().getFullYear();
  if (headerMatch) {
    const endRange = headerMatch[2];
    const yearMatch = endRange.match(/'?(\d{2,4})$/);
    if (yearMatch) {
      let parsedYear = yearMatch[1];
      if (parsedYear.length === 2) {
        parsedYear = "20" + parsedYear;
      }
      year = parseInt(parsedYear);
    }
  }

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  const txBlocks = [];
  let currentBlock = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isDate = /^\d{1,2}\s+[A-Za-z]{3}$/.test(line);
    const isNextTime = i + 1 < lines.length && /^\d{1,2}:\d{2}\s+(?:AM|PM|am|pm)$/i.test(lines[i + 1]);

    if (isDate && isNextTime) {
      if (currentBlock) {
        txBlocks.push(currentBlock);
      }
      currentBlock = [];
    }

    if (currentBlock) {
      currentBlock.push(line);
    }
  }
  if (currentBlock) {
    txBlocks.push(currentBlock);
  }

  const transactions = [];

  for (const block of txBlocks) {
    try {
      const dateLine = block.find(l => /^\d{1,2}\s+[A-Za-z]{3}$/.test(l));
      const timeLine = block.find(l => /^\d{1,2}:\d{2}\s+(?:AM|PM|am|pm)$/i.test(l));
      const merchantLine = block.find(l => /^(?:Paid\s*to|Received\s*from|Refund\s*from)\s+/i.test(l));
      const upiIdLine = block.find(l => /UPI\s*ID\s*:/i.test(l));
      const refNoLine = block.find(l => /UPI\s*Ref\s*No\s*:/i.test(l));
      const amountLine = block.find(l => /[+-]\s*(?:Rs\.?|INR|₹)\s*[\d,]+/i.test(l));

      if (!dateLine || !amountLine) {
        continue;
      }

      const dateParts = dateLine.split(/\s+/);
      const day = parseInt(dateParts[0]);
      const monthName = dateParts[1].toLowerCase().substring(0, 3);
      const month = MONTHS[monthName];
      if (isNaN(day) || month === undefined) {
        throw new Error(`Invalid date components: day=${day}, monthName=${monthName}`);
      }

      let dateObj = new Date(year, month, day);
      dateObj = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000));
      const formattedDate = dateObj.toISOString().split('T')[0];

      const time = timeLine ? timeLine.trim() : '';

      const merchantRaw = merchantLine ? merchantLine.replace(/^(?:Paid\s*to|Received\s*from|Refund\s*from)\s+/i, '').trim() : 'Unknown';

      let upiId = null;
      if (upiIdLine) {
        upiId = upiIdLine.replace(/UPI\s*ID\s*:\s*/i, '').replace(/\s+on\s*$/i, '').replace(/\s+on\s+Paytm\s*$/i, '').trim();
      }

      let referenceNumber = null;
      if (refNoLine) {
        const refMatch = refNoLine.match(/UPI\s*Ref\s*No\s*:\s*(\d+)/i);
        if (refMatch) referenceNumber = refMatch[1];
      }

      const amtMatch = amountLine.match(/([+-])\s*(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d+)?)/i);
      if (!amtMatch) throw new Error("Amount match failed: " + amountLine);
      const sign = amtMatch[1];
      const amount = parseFloat(amtMatch[2].replace(/,/g, ''));

      const accountLines = block.filter(l => {
        if (l === dateLine || l === timeLine || l === merchantLine || l === upiIdLine || l === refNoLine || l === amountLine) return false;
        if (/^Tag\s*:/i.test(l)) return false;
        if (/^#/i.test(l)) return false;
        return true;
      });
      const paymentAccount = accountLines.join(' ').trim();

      const transactionType = sign === '+' ? 'CREDIT' : 'DEBIT';

      let merchantClean = stripEmojis(merchantRaw);
      merchantClean = cleanMerchant(merchantClean);

      transactions.push({
        id: uuidv4(),
        provider: "PAYTM",
        date: formattedDate,
        time: time,
        merchant: merchantClean,
        normalizedMerchant: normalizeMerchant(merchantClean),
        amount: amount,
        transactionType,
        type: transactionType.toLowerCase(), // for pipeline compatibility
        transactionId: referenceNumber,
        upiRef: null,
        utrNumber: null,
        paymentAccount,
        upiId,
        uploadedAt: new Date().toISOString(),
        status: 'Success'
      });
    } catch (err) {
      console.warn("Skipping Paytm transaction due to parsing error:", err.message);
    }
  }

  return transactions;
}

function parseGeneric(text) {
  console.log("Generic parser not yet implemented");
  return [];
}

module.exports = {
  extractTransactions,
  parseGooglePay,
  parsePaytm,
  parseGeneric,
  parseAmount,
  cleanMerchant,
  normalizeMerchant
};
