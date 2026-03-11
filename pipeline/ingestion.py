# ingesting data and feature engineering
import pandas as pd
import numpy as np
 
def load_data(path: str) -> pd.DataFrame: 
    dtype_map = {
        'Sender_account': 'str',
        'Receiver_account': 'str',
        'Amount': 'float32',
        'Payment_currency': 'category',
        'Received_currency': 'category',
        'Sender_bank_location': 'category',
        'Receiver_bank_location': 'category',
        'Payment_type': 'category',
        'Is_laundering': 'int8',
        'Laundering_type': 'category',
    }
    df = pd.read_csv(path, dtype=dtype_map, parse_dates=['Date'])
    df['Time'] = pd.to_timedelta(df['Time']) 
    df['DateTime'] = df['Date'] + df['Time']
    return df

def add_transaction_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    For each transaction, numeric 
    """