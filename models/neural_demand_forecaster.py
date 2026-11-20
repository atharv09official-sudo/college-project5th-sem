import torch
import torch.nn as nn
from typing import Dict, Any


class ResidualBlock(nn.Module):
    def __init__(self, hidden_dim: int, dropout: float = 0.2):
        super().__init__()
        self.fc1 = nn.Linear(hidden_dim, hidden_dim)
        self.bn1 = nn.BatchNorm1d(hidden_dim)
        self.relu = nn.ReLU()
        self.dropout = nn.Dropout(dropout)
        self.fc2 = nn.Linear(hidden_dim, hidden_dim)
        self.bn2 = nn.BatchNorm1d(hidden_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x
        out = self.fc1(x)
        out = self.bn1(out)
        out = self.relu(out)
        out = self.dropout(out)
        out = self.fc2(out)
        out = self.bn2(out)
        return self.relu(out + residual)


class DeepDemandNet(nn.Module):
    """
    DeepDemandNet: Entity embedding architecture for FMCG demand prediction.
    - Store Embedding (d=16)
    - SKU Embedding (d=32)
    - Continuous features via 3-layer Residual MLP with Dropout (0.2) and BatchNorm
    """
    def __init__(
        self,
        num_stores: int = 50,
        num_skus: int = 100,
        store_emb_dim: int = 16,
        sku_emb_dim: int = 32,
        continuous_dim: int = 8,
        hidden_dim: int = 128,
        dropout: float = 0.2
    ):
        super().__init__()
        self.store_embedding = nn.Embedding(num_stores, store_emb_dim)
        self.sku_embedding = nn.Embedding(num_skus, sku_emb_dim)

        total_input_dim = store_emb_dim + sku_emb_dim + continuous_dim
        self.input_layer = nn.Sequential(
            nn.Linear(total_input_dim, hidden_dim),
            nn.BatchNorm1d(hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout)
        )

        self.res_block1 = ResidualBlock(hidden_dim, dropout=dropout)
        self.res_block2 = ResidualBlock(hidden_dim, dropout=dropout)
        self.res_block3 = ResidualBlock(hidden_dim, dropout=dropout)

        self.output_head = nn.Linear(hidden_dim, 1)

    def forward(self, store_ids: torch.Tensor, sku_ids: torch.Tensor, cont_features: torch.Tensor) -> torch.Tensor:
        store_emb = self.store_embedding(store_ids)
        sku_emb = self.sku_embedding(sku_ids)
        combined = torch.cat([store_emb, sku_emb, cont_features], dim=-1)

        x = self.input_layer(combined)
        x = self.res_block1(x)
        x = self.res_block2(x)
        x = self.res_block3(x)
        pred = self.output_head(x)
        return torch.relu(pred)  # Demand is non-negative
