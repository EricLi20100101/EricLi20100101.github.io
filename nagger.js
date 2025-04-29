document.addEventListener('DOMContentLoaded', () => {
    setTimeout(showNagger, 30000);
    loadRecentSearches();
    setupThemeToggle();
  });
  
  async function getCountryInfo(country = null) {
    const countryInput = country || document.getElementById('countryInput').value.trim();
    const resultDiv = document.getElementById('result');
  
    if (!countryInput) {
      resultDiv.innerHTML = '<div class="error">Please enter a country name!</div>';
      return;
    }
  
    resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  
    try {
      const countryCapitalized = countryInput.charAt(0).toUpperCase() + countryInput.slice(1).toLowerCase();
      const countryInfo = await fetchCountryData(countryCapitalized);
  
      if (!countryInfo) {
        resultDiv.innerHTML = `
          <div class="error">
            Could not find information for "${countryCapitalized}"
            <button onclick="getCountryInfo('${countryCapitalized}')">Retry</button>
          </div>`;
        return;
      }
  
      addToRecentSearches(countryCapitalized);
      const userCountryCode = localStorage.getItem('userCountry') || await getUserCountryByIP();
      let comparisonHTML = '';
  
      if (userCountryCode && countryInfo.currencyCode) {
        const userCountryInfo = await fetchCountryData(userCountryCode);
        if (userCountryInfo?.currencyCode) {
          const exchangeRate = await getExchangeRate(
            userCountryInfo.currencyCode,
            countryInfo.currencyCode
          );
  
          comparisonHTML = exchangeRate
            ? `<div class="comparison">
                <h3>Currency Comparison</h3>
                <p>1 ${userCountryInfo.currencyCode} = ${exchangeRate.toFixed(4)} ${countryInfo.currencyCode}</p>
              </div>`
            : `<div class="warning">Unable to fetch exchange rate between ${userCountryInfo.currencyCode} and ${countryInfo.currencyCode}</div>`;
        } else {
          comparisonHTML = `<div class="warning">Currency information unavailable for your location</div>`;
        }
      } else {
        comparisonHTML = `<div class="warning">Unable to detect your location for currency comparison</div>`;
      }
  
      resultDiv.innerHTML = formatCountryInfo(countryCapitalized, countryInfo, comparisonHTML);
      showNagger();
  
    } catch (error) {
      console.error("Error:", error);
      resultDiv.innerHTML = `
        <div class="error">
          An error occurred while fetching data. Please try again.
          <button onclick="getCountryInfo('${countryInput}')">Retry</button>
        </div>`;
    }
  }
  
  async function fetchCountryData(country) {
    const cacheKey = `country_${country}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
        return data;
      }
    }
  
    try {
      const query = country.toLowerCase() === 'china' ? 'china?fullText=true' : country;
      const response = await fetch(`https://restcountries.com/v3.1/name/${query}`);
      const data = await response.json();
      if (!data || data.length === 0) return null;
  
      let countryData = data[0];
      if (country.toLowerCase() === 'china') {
        countryData = data.find(d => d.cca2 === 'CN') || data[0];
      }
  
      const result = {
        flag: countryData.flags?.svg || '',
        population: countryData.population?.toLocaleString() || 'N/A',
        capital: countryData.capital?.[0] || 'N/A',
        currency: countryData.currencies ? Object.values(countryData.currencies)[0]?.name : 'N/A',
        currencyCode: countryData.currencies ? Object.keys(countryData.currencies)[0] : 'N/A',
        area: countryData.area ? `${countryData.area.toLocaleString()} km²` : 'N/A',
        continent: countryData.continents?.[0] || 'N/A',
        timezones: countryData.timezones?.join(', ') || 'N/A',
        languages: countryData.languages ? Object.values(countryData.languages).join(', ') : 'N/A',
        latlng: countryData.latlng || [0, 0]
      };
  
      localStorage.setItem(cacheKey, JSON.stringify({ data: result, timestamp: Date.now() }));
      return result;
    } catch (error) {
      console.error("Error fetching country data:", error);
      return null;
    }
  }
  
  function formatCountryInfo(name, info, comparisonHTML) {
    return `
      <h2>${name}</h2>
      <img src="${info.flag}" alt="Flag of ${name}" class="country-flag">
      <div class="info-grid">
        <div class="info-item"><span class="info-label">Capital:</span><span>${info.capital}</span></div>
        <div class="info-item"><span class="info-label">Population:</span><span>${info.population}</span></div>
        <div class="info-item"><span class="info-label">Currency:</span><span>${info.currency} (${info.currencyCode})</span></div>
        <div class="info-item"><span class="info-label">Area:</span><span>${info.area}</span></div>
        <div class="info-item"><span class="info-label">Continent:</span><span>${info.continent}</span></div>
        <div class="info-item"><span class="info-label">Languages:</span><span>${info.languages}</span></div>
      </div>
      <div class="map-container">
        <iframe width="100%" height="100%" frameborder="0" style="border:0;" loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"
          src="https://www.google.com/maps?q=${info.latlng[0]},${info.latlng[1]}&hl=en&z=5&output=embed">
        </iframe>
      </div>
      ${comparisonHTML}
      <div class="currency-converter">
        <h3>Convert Currency</h3>
        <input type="number" id="amountInput" placeholder="Enter amount" min="0">
        <button onclick="convertCurrency('${info.currencyCode}')">Convert</button>
        <div id="conversionResult"></div>
      </div>
    `;
  }
  
  async function getUserCountryByIP() {
    const services = [
      "https://ipinfo.io/json?token=03174ceef882fb",
      "https://ipapi.co/json/?key=demo",
      "https://freeipapi.com/api/json"
    ];
  
    for (const url of services) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const countryCode = data.country || data.countryCode || data.country_code;
          if (countryCode) {
            localStorage.setItem('userCountry', countryCode);
            return countryCode;
          }
        }
      } catch (e) {
        console.log(`Service ${url} failed.`);
      }
    }
  
    return null;
  }
  
  async function getExchangeRate(base, target) {
    if (!base || !target || base === target) return null;
    const cacheKey = `exchange_${base}_${target}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { rate, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 3600000) return rate;
    }
  
    try {
      const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`);
      const data = await response.json();
      const rate = data.rates?.[target];
      if (rate) {
        localStorage.setItem(cacheKey, JSON.stringify({ rate, timestamp: Date.now() }));
        return rate;
      }
    } catch (e) {
      console.error("Exchange rate error:", e);
    }
  
    return null;
  }
  
  async function convertCurrency(targetCurrency) {
    const amount = parseFloat(document.getElementById('amountInput').value);
    const resultDiv = document.getElementById('conversionResult');
    if (isNaN(amount) || amount <= 0) {
      resultDiv.innerHTML = `<div class="error">Please enter a valid amount</div>`;
      return;
    }
  
    const userCode = localStorage.getItem('userCountry') || await getUserCountryByIP();
    const userInfo = await fetchCountryData(userCode);
    if (!userInfo?.currencyCode) {
      resultDiv.innerHTML = `<div class="warning">Your currency is unknown</div>`;
      return;
    }
  
    const rate = await getExchangeRate(userInfo.currencyCode, targetCurrency);
    if (!rate) {
      resultDiv.innerHTML = `<div class="warning">Exchange rate unavailable</div>`;
      return;
    }
  
    const converted = (amount * rate).toFixed(2);
    resultDiv.innerHTML = `<p>${amount} ${userInfo.currencyCode} = ${converted} ${targetCurrency}</p>`;
  }
  
  function clearInput() {
    document.getElementById('countryInput').value = '';
    document.getElementById('result').innerHTML = '';
  }
  
  function addToRecentSearches(country) {
    let searches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    searches = searches.filter(c => c !== country);
    searches.unshift(country);
    searches = searches.slice(0, 5);
    localStorage.setItem('recentSearches', JSON.stringify(searches));
    loadRecentSearches();
  }
  
  function loadRecentSearches() {
    const list = document.getElementById('recentList');
    const searches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    list.innerHTML = searches.length
      ? searches.map(c => `<li onclick="getCountryInfo('${c}')">${c}</li>`).join('')
      : '<li>No recent searches</li>';
  }
  
  function clearRecentSearches() {
    if (confirm('Are you sure you want to clear your search history?')) {
      localStorage.removeItem('recentSearches');
      loadRecentSearches();
    }
  }
  
  function setupThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    const body = document.body;
    const isDark = localStorage.getItem('theme') === 'dark';
  
    if (isDark) {
      body.classList.add('dark-theme');
      toggle.textContent = '☀️';
    }
  
    toggle.addEventListener('click', () => {
      body.classList.toggle('dark-theme');
      const isDarkNow = body.classList.contains('dark-theme');
      toggle.textContent = isDarkNow ? '☀️' : '🌙';
      localStorage.setItem('theme', isDarkNow ? 'dark' : 'light');
    });
  }
  
  function showNagger() {
    document.getElementById('nagger').style.display = 'flex';
  }
  
  function dismissNagger() {
    document.getElementById('nagger').style.display = 'none';
  }
  