import React from 'react';
import './Modal.css';

const Modal = ({ show, title, message, onConfirm, buttonText }) => {
    // If 'show' is false, render nothing
    if (!show) {
        return null;
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                {/* Optional Icon/Image can go here */}
                <div className="modal-header">
                    <h2>{title}</h2>
                </div>

                <div className="modal-body">
                    <p>{message}</p>
                </div>

                <div className="modal-footer">
                    <button className="modal-btn-primary" onClick={onConfirm}>
                        {buttonText || "Continue"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Modal;