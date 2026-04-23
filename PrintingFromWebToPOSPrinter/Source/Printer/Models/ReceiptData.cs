using System;
using System.Collections.Generic;

namespace Printer.Models
{
    public class ReceiptData
    {
        public string OrderId { get; set; }
        public string SaleNumber { get; set; }
        public string BarcodeValue { get; set; }
        public DateTime? OrderDate { get; set; }
        public DateTime? SaleDate { get; set; }
        public CustomerInfo Customer { get; set; }
        public BranchInfo Branch { get; set; }
        public UserInfo Cashier { get; set; }
        public UserInfo ServedBy { get; set; }
        public List<ReceiptItem> Items { get; set; }
        public decimal Subtotal { get; set; }
        public decimal Tax { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal Discount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal ShippingCost { get; set; }
        public decimal Total { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal ReceivedAmount { get; set; }
        public decimal ChangeAmount { get; set; }
        public PaymentInfo Payment { get; set; }
        public List<PaymentInfo> Payments { get; set; }
        public string PaymentStatus { get; set; }
        public string Notes { get; set; }
        public bool OpenCashDrawer { get; set; }

        public ReceiptData()
        {
            OrderId = "";
            SaleNumber = "";
            BarcodeValue = "";
            Items = new List<ReceiptItem>();
            Payments = new List<PaymentInfo>();
            Notes = "";
            OpenCashDrawer = true;
        }
    }

    public class CustomerInfo
    {
        public string Name { get; set; }
        public string Phone { get; set; }
        public string Address { get; set; }
        public int? RewardPoints { get; set; }
        public int? PointsEarned { get; set; }
        public int? PointsRedeemed { get; set; }

        public CustomerInfo()
        {
            Name = "";
            Phone = "";
            Address = "";
            RewardPoints = null;
            PointsEarned = null;
            PointsRedeemed = null;
        }
    }

    public class BranchInfo
    {
        public string Name { get; set; }
        public string Address { get; set; }
        public string Phone { get; set; }
        public string Email { get; set; }

        public BranchInfo()
        {
            Name = "";
            Address = "";
            Phone = "";
            Email = "";
        }
    }

    public class UserInfo
    {
        public string Name { get; set; }
        public string Id { get; set; }

        public UserInfo()
        {
            Name = "";
            Id = "";
        }
    }

    public class ReceiptItem
    {
        public string Name { get; set; }
        public string ProductName { get; set; }
        public string Description { get; set; }
        public int Quantity { get; set; }
        public decimal Price { get; set; }
        public decimal UnitPrice { get; set; }
        public decimal Total { get; set; }
        public decimal LineTotal { get; set; }
        public decimal GrossLineTotal { get; set; }
        public decimal AverageDiscountAmount { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal SpecialDiscountAmount { get; set; }
        public decimal PromotionDiscountAmount { get; set; }
        public decimal TaxAmount { get; set; }
        public decimal TaxPercentage { get; set; }
        public string TaxMethod { get; set; }

        public ReceiptItem()
        {
            Name = "";
            ProductName = "";
            Description = "";
            Quantity = 1;
            TaxMethod = "";
        }
    }

    public class PaymentInfo
    {
        public string Method { get; set; }
        public string PaymentMethod { get; set; }
        public decimal Amount { get; set; }
        public decimal AmountPaid { get; set; }
        public decimal Change { get; set; }

        public PaymentInfo()
        {
            Method = "Cash";
            PaymentMethod = "Cash";
        }
    }
}
