# FAANG Stock Price Prediction

> ML-powered stock analysis using Random Forest, XGBoost, Neural Networks, and Claude AI

##  Project Overview
Predicts FAANG stock price direction using 10 years of market data (2016-2026).
14,964 training samples | 6 tickers | 12 engineered features | Claude AI integration

##  ML Models & Results
| Model | Accuracy | Type |
|-------|----------|------|
| XGBoost (GBM) | 62.3% | Classification |
| Neural Network | 64.7% | Classification |
| Random Forest | 56.8% | Classification |
| Gradient Boosting | 58.9% | Classification |

## Skills Showcased
- Classification: Binary (UP/DOWN) + Multi-class (UP/FLAT/DOWN)
- Regression: Next-day return % prediction
- Ensemble Methods: RF, XGBoost, Gradient Boosting
- Deep Learning: Neural Network (128→64→32 layers)
- Clustering: K-Means (4 risk segments)
- Feature Engineering: 12 custom technical indicator features
- LLM Integration: Claude AI for market analysis

## Dataset
FAANG stocks: AAPL, AMZN, GOOGL, META, MSFT, NVDA
Source: faang_stock_prices.csv | Period: Feb 2016 → Jan 2026

##  How to Run
```bash
pip install pandas numpy matplotlib seaborn scikit-learn jupyter
jupyter notebook FAANG_Stock_Prediction.ipynb
```

## Key Findings
- NVDA: +23,880% return since 2016 (best performer)
- Top predictive feature: 7-day Volatility (importance: 0.0503)
- XGBoost beats random baseline by 12.3 percentage points

## Contact
Mithraa Prabakar C B | mithraaprabakar@gmail.com 
