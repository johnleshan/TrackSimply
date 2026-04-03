import React, { useState } from 'react';
import './ProductModal.css';

const ProductModal = ({ product, isOpen, onClose, onAddToBag }) => {
  const [quantity, setQuantity] = useState(1);
  const [isFilesOpen, setIsFilesOpen] = useState(false);

  if (!isOpen) return null;

  const handleDecrease = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const handleIncrease = () => {
    setQuantity(quantity + 1);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass animate-fade" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" aria-label="Close modal" onClick={onClose}>
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div className="modal-grid">
          <div className="modal-left">
            <div className="modal-image-container">
              <img src={product.image} alt={product.name} className="modal-image" />
              
              <div className="modal-carousel-controls">
                <button className="m-carousel-btn prev">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>
                <button className="m-carousel-btn next">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>

              <div className="modal-dots">
                <span className="dot active"></span>
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
              </div>
            </div>
          </div>

          <div className="modal-right">
            <div className="product-details">
              <h2 className="m-product-name">{product.name}</h2>
              <p className="m-product-author">By TrackSimply</p>
              
              <div className="m-product-description">
                {product.description}
              </div>

              <div className="files-dropdown">
                <button 
                  className={`files-header ${isFilesOpen ? 'open' : ''}`} 
                  onClick={() => setIsFilesOpen(!isFilesOpen)}
                >
                  <span>{product.filesCount} files included</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="chevron">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                {isFilesOpen && (
                  <ul className="files-list">
                    <li>Excel Spreadsheet (.xlsx)</li>
                    <li>Instruction Guide (.pdf)</li>
                  </ul>
                )}
              </div>

              <div className="purchase-controls">
                <div className="quantity-selector">
                  <p className="label">How Many</p>
                  <div className="counter">
                    <button onClick={handleDecrease} className="count-btn">−</button>
                    <span className="count">{quantity}</span>
                    <button onClick={handleIncrease} className="count-btn">+</button>
                  </div>
                </div>

                <div className="price-section">
                  <p className="label">Price</p>
                  <p className="m-price">KES {product.price}</p>
                </div>

                <div className="action-buttons">
                  <button className="add-to-bag-btn" onClick={() => onAddToBag(quantity)}>
                    Add to bag
                  </button>
                  <button className="contact-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="heart-icon">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    Contact Seller
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="chevron-icon">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
