import React from "react";
import { toast } from "react-toastify";
import api from "lib/api";
import { RangeSlider } from "components";
import { formatPrice } from "lib/utils";
import "./SpotForm.css";
import ConnectWalletButton from "../../atoms/ConnectWalletButton/ConnectWalletButton";

export class SpotForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      userHasEditedPrice: false,
      price: "",
      baseAmount: "",
      quoteAmount: "",
      orderButtonDisabled: false,
      maxSizeSelected: false,
    };
  }

  updatePrice(e) {
    const newState = { ...this.state };
    newState.price = e.target.value;
    newState.userHasEditedPrice = true;
    this.setState(newState);
  }

  updateAmount(e) {
    const newState = { ...this.state };
    newState.baseAmount = e.target.value;
    newState.quoteAmount = "";
    newState.maxSizeSelected = false;
    this.setState(newState);
  }

  getBaseBalance() {
    const marketInfo = this.props.marketInfo;
    if (!marketInfo) return 0;
    if (!this.props.balances?.[marketInfo.baseAsset.symbol]?.valueReadable) return 0;
    return (
      this.props.balances[marketInfo.baseAsset.symbol].valueReadable
    );
  }

  getQuoteBalance() {
    const marketInfo = this.props.marketInfo;
    if (!marketInfo) return 0;
    if (!this.props.balances?.[marketInfo.quoteAsset.symbol]?.valueReadable) return 0;
    return (
      this.props.balances[marketInfo.quoteAsset.symbol].valueReadable
    );
  }

  getBaseAllowance() {
    const marketInfo = this.props.marketInfo;
    if (!marketInfo) return 0;
    if (!this.props.balances?.[marketInfo.baseAsset.symbol]?.allowanceReadable) return 0;
    return (
      this.props.balances[marketInfo.baseAsset.symbol].allowanceReadable
    );
  }

  getQuoteAllowance() {
    const marketInfo = this.props.marketInfo;
    if (!marketInfo) return 0;
    if (!this.props.balances?.[marketInfo.quoteAsset.symbol]?.allowanceReadable) return 0;
    return (
      this.props.balances[marketInfo.quoteAsset.symbol].allowanceReadable
    );
  }

  /*
   * zkSync does not allow partial fills, so the ladder price is the first
   * liquidity that can fill the order size. 
   */
  getLadderPriceZkSync_v1() {
    let baseAmount = this.state.baseAmount;
    const side = this.props.side;

    if (!baseAmount) baseAmount = 0;

    let price;
    if (side === "b") {
      const asks = this.props.liquidity.filter((l) => l[0] === "s");
      asks.sort((a, b) => a[1] - b[1]);

      for (let i = 0; i < asks.length; i++) {
        if (asks[i][2] >= baseAmount || i === asks.length - 1) {
          price = asks[i][1];
          break;
        }
      }
    } else if (side === "s") {
      const bids = this.props.liquidity.filter((l) => l[0] === "b");
      bids.sort((a, b) => b[1] - a[1]);

      for (let i = 0; i < bids.length; i++) {
        if (bids[i][2] >= baseAmount || i === bids.length - 1) {
          price = bids[i][1];
          break;
        }
      }
    }
    if (!price) return 0;
    return formatPrice(price);
  }

  getLadderPrice() {
    let baseAmount = this.state.baseAmount;
    const side = this.props.side;

    if (!baseAmount) baseAmount = 0;

    let price;
    let unfilled = baseAmount;
    if (side === "b" && this.props.orderbookAsks) {
      const asks = this.props.orderbookAsks;
      for (let i = 0; i < asks.length; i++) {
        if (asks[i].td2 >= unfilled || i === asks.length - 1) {
          price = asks[i].td1;
          break;
        } else {
          unfilled -= asks[i].td2;
        }
      }
    } else if (side === "s" && this.props.orderbookBids) {
      const bids = this.props.orderbookBids;
      for (let i = 0; i < bids.length; i++) {
        if (bids[i].td2 >= unfilled || i === bids - 1) {
          price = bids[i].td1;
          break;
        } else {
          unfilled -= bids[i].td2;
        }
      }
    }
    if (!price) return 0;
    return formatPrice(price);
  }

  async approveHandler(e) {
    const marketInfo = this.props.marketInfo;
    const token = (this.props.side === "s")
      ? marketInfo.baseAsset.symbol
      : marketInfo.quoteAsset.symbol;    

    let newstate = { ...this.state };
    newstate.orderButtonDisabled = true;
    this.setState(newstate);
    let orderApproveToast = toast.info(
      "Approve pending. Sign or Cancel to continue...", {
      toastId: "Approve pending. Sign or Cancel to continue...",
      autoClose: false,
    });

    try {
      await api.approveExchangeContract(
        token,
        0 // amount = 0 ==> MAX_ALLOWANCE
      );
    } catch (e) {
      console.log(e);
      toast.error(e.message);
    }

    toast.dismiss(orderApproveToast);
    newstate = { ...this.state };
    newstate.orderButtonDisabled = false;
    this.setState(newstate);
  }

  async buySellHandler(e) {
    let baseAmount, quoteAmount;
    if (typeof this.state.baseAmount === "string") {
      baseAmount = parseFloat(this.state.baseAmount.replace(",", "."));
    } else {
      baseAmount = this.state.baseAmount;
    }
    if (typeof this.state.quoteAmount === "string") {
      quoteAmount = parseFloat(this.state.quoteAmount.replace(",", "."));
    } else {
      quoteAmount = this.state.quoteAmount;
    }

    quoteAmount = isNaN(quoteAmount) ? 0 : quoteAmount
    baseAmount = isNaN(baseAmount) ? 0 : baseAmount
    if (!baseAmount && !quoteAmount) {
      toast.error("No amount available", {
        toastId: 'No amount available',
      });
      return;
    }

    let price = this.currentPrice();
    if (!price) {
      toast.error("No price available", {
        toastId: 'No price available',
      });
      return;
    }

    price = Number(price);
    if (price < 0) {
      toast.error(`Price (${price}) can't be below 0`, {
        toastId: `Price (${price}) can't be below 0`,
      });
      return;
    }

    if (this.props.activeOrderCount > 0 && api.isZksyncChain()) {
      toast.error("Only one active order permitted at a time", {
        toastId: 'Only one active order permitted at a time',
      });
      return;
    }
    let baseBalance, quoteBalance, baseAllowance, quoteAllowance;
    if (this.props.user.id) {
      baseBalance = this.getBaseBalance();
      quoteBalance = this.getQuoteBalance();
      baseAllowance = this.getBaseAllowance();
      quoteAllowance = this.getQuoteAllowance();
    } else {
      baseBalance = 0;
      quoteBalance = 0;
      baseAllowance = 0;
      quoteAllowance = 0;
    }

    const marketInfo = this.props.marketInfo;
    baseBalance = parseFloat(baseBalance);
    quoteBalance = parseFloat(quoteBalance);
    let baseAmountMsg;
    if (this.props.side === "s") {
      baseAmount = baseAmount ? baseAmount : (quoteAmount / price);
      quoteAmount = 0;
      baseAmountMsg = formatPrice(baseAmount);

      if (isNaN(baseBalance)) {
        toast.error(`No ${marketInfo.baseAsset.symbol} balance`, {
          toastId: `No ${marketInfo.baseAsset.symbol} balance`,
        });
        return;
      }

      if (baseAmount && (baseAmount + marketInfo.baseFee) > baseBalance) {
        toast.error(`Amount exceeds ${marketInfo.baseAsset.symbol} balance`, {
          toastId: `Amount exceeds ${marketInfo.baseAsset.symbol} balance`,
        });
        return;
      }

      if (baseAmount && baseAmount < marketInfo.baseFee) {
        toast.error(
          `Minimum order size is ${marketInfo.baseFee.toPrecision(5)
          } ${marketInfo.baseAsset.symbol}`
        );
        return;
      }

      if (baseAmount && baseAmount > baseAllowance) {
        toast.error(`Amount exceeds ${marketInfo.baseAsset.symbol} allowance`, {
          toastId: `Amount exceeds ${marketInfo.baseAsset.symbol} allowance`,
        });
        return;
      }

      const askPrice = this.getFirstAsk();
      const delta = ((askPrice - price) / askPrice) * 100;
      if (delta > 10 && this.props.orderType === "limit") {
        toast.error(
          `You are selling ${delta.toFixed(2)
          }% under the current market price. You will lose money when signing this transaction!`,
          {
            toastId: `You are selling ${delta.toFixed(2)
              }% under the current market price. You will lose money when signing this transaction!`,
          });
      }

      if (this.props.orderType === "market") {
        price *= 0.9985;
        if (delta > 2) {
          toast.error(
            `You are selling ${delta.toFixed(2)
            }% under the current market price. You could lose money when signing this transaction!`,
            {
              toastId: `You are selling ${delta.toFixed(2)
                }% under the current market price. You could lose money when signing this transaction!`,
            });
        }
      }
    } else if (this.props.side === "b") {
      quoteAmount = quoteAmount ? quoteAmount : (baseAmount * price);
      baseAmount = 0;
      baseAmountMsg = formatPrice(quoteAmount / price);

      if (isNaN(quoteBalance)) {
        toast.error(`No ${marketInfo.quoteAsset.symbol} balance`, {
          toastId: `No ${marketInfo.quoteAsset.symbol} balance`,
        });
        return;
      }

      if (quoteAmount && (quoteAmount + marketInfo.quoteFee) > quoteBalance) {
        toast.error(`Total exceeds ${marketInfo.quoteAsset.symbol} balance`, {
          toastId: `Total exceeds ${marketInfo.quoteAsset.symbol} balance`,
        });
        return;
      }

      if (quoteAmount && quoteAmount < marketInfo.quoteFee) {
        toast.error(
          `Minimum order size is ${marketInfo.quoteFee.toPrecision(5)
          } ${marketInfo.quoteAsset.symbol}`, {
            toastId: `Minimum order size is ${marketInfo.quoteFee.toPrecision(5)
            } ${marketInfo.quoteAsset.symbol}`,
          });
        return;
      }

      if (quoteAmount && quoteAmount > quoteAllowance) {
        toast.error(`Total exceeds ${marketInfo.quoteAsset.symbol} allowance`, {
          toastId: `Total exceeds ${marketInfo.quoteAsset.symbol} allowance`,
        });
        return;
      }

      const bidPrice = this.getFirstBid();
      const delta = ((price - bidPrice) / bidPrice) * 100;
      if (delta > 10 && this.props.orderType === "limit") {
        toast.error(
          `You are buying ${delta.toFixed(2)
          }% above the current market price. You will lose money when signing this transaction!`,
          {
            toastId: `You are buying ${delta.toFixed(2)
              }% above the current market price. You will lose money when signing this transaction!`,
          });
      }

      if (this.props.orderType === "market") {
        price *= 1.0015;
        if (delta > 2) {
          toast.error(
            `You are buying ${delta.toFixed(2)
            }% above the current market price. You could lose money when signing this transaction!`,
            {
              toastId: `You are buying ${delta.toFixed(2)
                }% above the current market price. You could lose money when signing this transaction!`,
            });
        }
      }
    }

    const renderGuidContent = () => {
      return <div>
        <p style={{ fontSize: '14px', lineHeight: '24px' }}>{this.props.side === 's' ? 'Sell' : 'Buy'} Order pending</p>
        <p style={{ fontSize: '14px', lineHeight: '24px' }}>{baseAmountMsg} {marketInfo.baseAsset.symbol} @ {
          ['USDC', 'USDT', 'DAI', 'FRAX'].includes(marketInfo.quoteAsset.symbol) ? price.toFixed(2) : formatPrice(price)
        } {marketInfo.quoteAsset.symbol}</p>
        <p style={{ fontSize: '14px', lineHeight: '24px' }}>Sign or Cancel to continue...</p>
      </div>
    }

    let newstate = { ...this.state };
    newstate.orderButtonDisabled = true;
    this.setState(newstate);
    let orderPendingToast = toast.info(
      renderGuidContent(), {
      toastId: "Order pending",
      autoClose: false,
    }
    );


    try {
      await api.submitOrder(
        this.props.currentMarket,
        this.props.side,
        price,
        baseAmount,
        quoteAmount,
        this.props.orderType
      );
    } catch (e) {
      console.log(e);
      toast.error(e.message);
    }

    toast.dismiss(orderPendingToast);
    newstate = { ...this.state };
    newstate.orderButtonDisabled = false;
    this.setState(newstate);
  }

  priceIsDisabled() {
    return this.props.orderType === "market";
  }

  amountPercentOfMax() {
    if (!this.props.user.id) return 0;

    const marketInfo = this.props.marketInfo;
    if (!this.props.marketInfo) return 0;

    if (this.props.side === "s") {
      const baseBalance = this.getBaseBalance() - marketInfo.baseFee;
      const baseAmount = this.state.baseAmount || 0;
      return Math.round((baseAmount / baseBalance) * 100);
    } else if (this.props.side === "b") {
      const quoteBalance = this.getQuoteBalance() - marketInfo.quoteFee;;
      if (this.state.quoteAmount) {
        const quoteAmount = this.state.quoteAmount || 0;
        return Math.round((quoteAmount / quoteBalance) * 100);
      } else {
        const baseAmount = this.state.baseAmount || 0;
        const total = baseAmount * this.currentPrice();
        return Math.round((total / quoteBalance) * 100);
      }
    }
  }

  currentPrice() {
    const marketInfo = this.props.marketInfo;
    if (!marketInfo) return 0;

    if (this.props.orderType === "limit" && this.state.price) {
      return this.state.price;
    } else {
      if (api.isZksyncChain()) {
        return this.getLadderPriceZkSync_v1();
      } else {
        return this.getLadderPrice();
      }
    }
  }

  getFirstAsk() {
    const marketInfo = this.props.marketInfo;
    if (!marketInfo) return 0;
    const asks = this.props.liquidity
      .filter((l) => l[0] === "s")
      .map((l) => l[1]);
    return formatPrice(Math.min(...asks));
  }

  getFirstBid() {
    const marketInfo = this.props.marketInfo;
    if (!marketInfo) return 0;
    const bids = this.props.liquidity
      .filter((l) => l[0] === "b")
      .map((l) => l[1]);
    return formatPrice(Math.max(...bids));
  }

  rangeSliderHandler(e, val) {
    const marketInfo = this.props.marketInfo;
    if (!marketInfo) return 0;
    if (!this.props.user.id) return false;

    const newstate = { ...this.state };
    if (val === 100) {
      newstate.maxSizeSelected = true;
      if (this.props.side === "b") {
        val = 99.9;
      }
      if (this.props.side === "s") {
        val = 99.9;
      }
    } else {
      newstate.maxSizeSelected = false;
    }
    if (this.props.side === "s") {
      const baseBalance = this.getBaseBalance();
      const decimals = marketInfo.baseAsset.decimals;
      let displayAmount = (baseBalance * val) / 100;
      displayAmount -= marketInfo.baseFee;
      displayAmount = parseFloat(displayAmount.toFixed(decimals))
      displayAmount = (displayAmount > 9999)
        ? displayAmount.toFixed(0)
        : displayAmount.toPrecision(5)

      if (displayAmount < 1e-5) {
        newstate.baseAmount = 0;
      } else {
        newstate.baseAmount = displayAmount;
      }
    } else if (this.props.side === "b") {
      const quoteBalance = this.getQuoteBalance();
      const quoteDecimals = marketInfo.quoteAsset.decimals;
      const baseDecimals = marketInfo.baseAsset.decimals;
      let displayAmount = (quoteBalance * val) / 100;
      displayAmount -= marketInfo.quoteFee;
      displayAmount = parseFloat(displayAmount.toFixed(quoteDecimals))
      displayAmount = (displayAmount > 9999)
        ? displayAmount.toFixed(0)
        : displayAmount.toPrecision(5)

      if (displayAmount < 1e-5) {
        newstate.quoteAmount = 0;
      } else {
        newstate.quoteAmount = displayAmount;
        const baseDisplayAmount = parseFloat(
          (displayAmount / this.currentPrice()).toFixed(baseDecimals)
        )
        newstate.baseAmount = (baseDisplayAmount > 9999)
          ? baseDisplayAmount.toFixed(0)
          : baseDisplayAmount.toPrecision(5)
      }
    }

    if (isNaN(newstate.baseAmount)) newstate.baseAmount = 0;
    if (isNaN(newstate.quoteAmount)) newstate.quoteAmount = 0;
    this.setState(newstate);
  }

  componentDidUpdate(prevProps, prevState) {
    // Prevents bug where price volatility can cause buy amount to be too large
    // by refreshing a maxed out buy amount to match the new price
    if (
      this.props.lastPrice !== prevProps.lastPrice &&
      this.state.maxSizeSelected
    ) {
      this.rangeSliderHandler(null, 100);
    }

    if (this.props.currentMarket !== prevProps.currentMarket) {
      this.setState((state) => ({ ...state, price: "", baseAmount: "", quoteAmount: "" }));
    }
  }

  render() {
    const marketInfo = this.props.marketInfo;
    let baseAmount, quoteAmount;
    if (typeof this.state.baseAmount === "string") {
      baseAmount = parseFloat(this.state.baseAmount.replace(",", "."));
    } else {
      baseAmount = this.state.baseAmount;
    }
    if (typeof this.state.quoteAmount === "string") {
      quoteAmount = parseFloat(this.state.quoteAmount.replace(",", "."));
    } else {
      quoteAmount = this.state.quoteAmount;
    }

    let price = this.currentPrice();
    if (price === 0) price = "";

    let baseBalance, quoteBalance, baseAllowance, quoteAllowance;
    if (this.props.user.id) {
      baseBalance = this.getBaseBalance();
      quoteBalance = this.getQuoteBalance();
      baseAllowance = this.getBaseAllowance();
      quoteAllowance = this.getQuoteAllowance();
    } else {
      baseBalance = 0;
      quoteBalance = 0;
      baseAllowance = 0;
      quoteAllowance = 0;
    }
    if (isNaN(baseBalance)) {
      baseBalance = 0;
    }
    if (isNaN(quoteBalance)) {
      quoteBalance = 0;
    }

    const baseSymbol = marketInfo?.baseAsset?.symbol ? marketInfo.baseAsset.symbol : '';
    const quoteSymbol = marketInfo?.quoteAsset?.symbol ? marketInfo.quoteAsset.symbol : '';
    const balanceHtml =
      this.props.side === "b" ? (
        <strong>
          {Number(quoteBalance).toPrecision(8)}{" "}
          {quoteSymbol}
        </strong>
      ) : (
        <strong>
          {Number(baseBalance).toPrecision(8)}{" "}
          {baseSymbol}
        </strong>
      );

    let buySellBtnClass, buttonText, approveNeeded = false;
    quoteAmount = quoteAmount ? quoteAmount : this.currentPrice() * this.state.baseAmount;
    if (this.props.side === "b") {
      buySellBtnClass = "bg_btn buy_btn";
      if (quoteAmount > quoteAllowance)  {
        buttonText = `Approve ${quoteSymbol}`;
        approveNeeded = true;
      } else {
        buttonText = `BUY ${baseSymbol}`;
      }
    } else if (this.props.side === "s") {
      buySellBtnClass = "bg_btn sell_btn";
      if (baseAmount > baseAllowance)  {
        buttonText = `Approve ${baseSymbol}`;
        approveNeeded = true;
      } else {
        buttonText = `SELL ${baseSymbol}`;
      }
    }

    return (
      <>
        <form className="spot_form">
          <div className="spf_head">
            <span>Available balance</span>
            {balanceHtml}
          </div>

          <div className="spf_input_box">
            <span className="spf_desc_text">Price</span>
            <input
              type="text"
              value={
                this.state.userHasEditedPrice ? this.state.price : this.currentPrice()
              }
              onChange={this.updatePrice.bind(this)}
              disabled={this.priceIsDisabled()}
            />
            <span className={this.priceIsDisabled() ? "text-disabled" : ""}>
              {quoteSymbol}
            </span>
          </div>
          <div className="spf_input_box">
            <span className="spf_desc_text">Amount</span>
            <input
              type="text"
              value={this.state.baseAmount || 0.00}
              placeholder="0.00"
              onChange={this.updateAmount.bind(this)}
            />
            <span>{baseSymbol}</span>
          </div>
          <div className="spf_range">
            <RangeSlider
              value={this.amountPercentOfMax()}
              onChange={this.rangeSliderHandler.bind(this)}
            />
          </div>
          {this.props.user.id ? (
            <div className="">
              <div className="spf_head">
                <span>Total</span>
                <strong>
                  <>
                    {(this.currentPrice() * this.state.baseAmount).toPrecision(6)}{" "}
                    {quoteSymbol}
                  </>
                </strong>
              </div>
              <div className="spf_btn">
                <button
                  type="button"
                  className={buySellBtnClass}
                  onClick={approveNeeded ? this.approveHandler.bind(this) : this.buySellHandler.bind(this)}
                  disabled={this.state.orderButtonDisabled}
                >
                  {buttonText}
                </button>
              </div>
            </div>
          ) : (
            <div className="spf_btn">
              <ConnectWalletButton />
            </div>
          )}
        </form>
      </>
    );
  }
}
