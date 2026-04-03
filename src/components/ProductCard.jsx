import React from 'react';
import './ProductCard.css';

const ProductCard = ({ product, onOpenModal }) => {
  return (
    <div className="product-card animate-fade" onClick={() => onOpenModal(product)}>
      <div className="product-image-container">
        <img src={product.image} alt={product.name} className="product-image" />
        <div className="product-overlay">
          <button className="view-details-btn">Quick View</button>
        </div>
        <div className="carousel-controls">
          <button className="carousel-btn prev" aria-label="Previous image">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <button className="carousel-btn next" aria-label="Next image">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>
      <div className="product-info">
        <h3 className="product-name">{product.name}</h3>
        <p className="product-price">KES {product.price}</p>
      </div>
    </div>
  );
};

export default ProductCard;
