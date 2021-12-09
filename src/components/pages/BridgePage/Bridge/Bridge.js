import React, { useMemo, useEffect, useState } from 'react'
import { useSelector } from "react-redux";
import { SwapButton, Button, useCoinEstimator } from 'components'
import {
  networkSelector,
} from "lib/store/features/api/apiSlice"
import { userSelector } from "lib/store/features/auth/authSlice";
import ethLogo from "assets/images/currency/ETH.svg"
import api from 'lib/api';
import { MAX_ALLOWANCE } from 'lib/api/constants';
import { formatUSD } from 'lib/utils';
import cx from 'classnames';
import { BiError } from 'react-icons/bi';
import { MdSwapCalls } from 'react-icons/md';
import darkPlugHead from 'assets/icons/dark-plug-head.png';
import logo from 'assets/images/logo.png'
import BridgeSwapInput from '../BridgeSwapInput/BridgeSwapInput';

const defaultTransfer = {
  type: 'deposit',
}

const Bridge = () => {
  // eslint-disable-next-line
  const user = useSelector(userSelector)
  const [zkBalances, setBalances] = useState({});
  const [loading, setLoading] = useState(false);
  const [isApproving, setApproving] = useState(false);
  const [walletBalances, setWalletBalances] = useState({});
  const [formErr, setFormErr] = useState('') // eslint-disable-line no-unused-vars
  const network = useSelector(networkSelector);
  const [transfer, setTransfer] = useState(defaultTransfer);
  const [swapDetails, _setSwapDetails] = useState(() => ({ amount: '', currency: 'ETH' }));
  const currencies = useMemo(() => null, [transfer.type])
  const coinEstimator = useCoinEstimator()

  useEffect(() => {
    api.getBalances().then(newBalances => {
      setBalances(newBalances)
    })
  }, [user])

  useEffect(() => {
    const watchWalletFn = () => {
      api.getWalletBalances().then(newWalletBalances => {
        setWalletBalances(newWalletBalances)
      })
    }

    let watchWallet = setInterval(watchWalletFn, 7000)
    watchWalletFn()

    return () => {
      clearInterval(watchWallet)
    }
  }, [])

  const setSwapDetails = values => {
    const details = {
      ...swapDetails,
      ...values,
    };
    
    _setSwapDetails(details);

    const bals = transfer.type === 'deposit' ? walletBalances : zkBalances
    const detailBalance = parseFloat((bals[details.currency] && bals[details.currency].valueReadable) || 0)
    const input = parseFloat(details.amount || 0)

    if (input < 0.001 && details.amount !== '') {
      setFormErr('Must be at least 0.001')
    } else if (input > detailBalance) {
      setFormErr('Insufficient balance')
    } else {
      setFormErr('')
    }
  }

  const switchTransferType = e => {
    if (e) e.preventDefault()
    setTransfer({ type: transfer.type === 'deposit' ? 'withdraw' : 'deposit' })
    setSwapDetails({ amount: '', currency: 'ETH' })
  }
  
  const ethLayer1Header = (
    <div className="bridge_coin_details">
      <div className="bridge_coin_image" style={{ background: '#fff' }}>
        <img
          alt="Ethereum logo"
          src={ethLogo}
        />
      </div>
      <div className="bridge_coin_name">Ethereum L1</div>
    </div>
  )

  const zkSyncLayer2Header = (
    <div className="bridge_coin_details">
      <div className="bridge_coin_image">
        <img alt="Logo" src={logo} />
      </div>
      <div className="bridge_coin_name">zkSync L2</div>
    </div>
  )

  const balances = transfer.type === 'deposit' ? walletBalances : zkBalances 
  const altBalances = transfer.type === 'deposit' ? zkBalances : walletBalances
  const hasAllowance = balances[swapDetails.currency] && balances[swapDetails.currency].allowance.gte(MAX_ALLOWANCE.div(3))
  const hasError = formErr && formErr.length > 0

  const approveSpend = (e) => {
    if (e) e.preventDefault()
    setApproving(true)
    api.approveSpendOfCurrency(swapDetails.currency)
      .then(() => {
        setApproving(false)
      })
      .catch(err => {
        console.log(err)
        setApproving(false)
      })
  }

  const doTransfer = e => {
    e.preventDefault()
    let deferredXfer

    setLoading(true)

    if (transfer.type === 'deposit') {
      deferredXfer = api.depositL2(`${swapDetails.amount}`, swapDetails.currency)
    } else {
      deferredXfer = api.withdrawL2(`${swapDetails.amount}`, swapDetails.currency)
    }

    deferredXfer
      .then(state => {
        setTimeout(() => api.getAccountState(), 1000)
        setLoading(false)
      })
      .catch(e => {
        console.log(e.message)
        setLoading(false)
      })
  }

  return (
    <div className="bridge_box">
      <div className="bridge_box_top">
        <div className="bridge_coin_title">
          <h5>FROM</h5>
          {transfer.type === 'withdraw' ? zkSyncLayer2Header : ethLayer1Header}
        </div>
        <BridgeSwapInput balances={balances} currencies={currencies} value={swapDetails} onChange={setSwapDetails} />
        <div className="bridge_coin_stats">
          <div className="bridge_coin_stat">
            <h5>Estimated value</h5>
            <span>~${formatUSD((+swapDetails.amount * coinEstimator(swapDetails.currency) || 0))}</span>
          </div>
          <div className="bridge_coin_stat">
            <h5>Available balance</h5>
            <span>
              {balances[swapDetails.currency] && balances[swapDetails.currency].valueReadable}
              {` ${swapDetails.currency}`}
            </span>
          </div>
        </div>
      </div>

      <div className="bridge_box_bottom">
        <div className="bridge_box_swap_wrapper">
          <SwapButton onClick={switchTransferType} />
          <h5>Switch</h5>
        </div>

        <div className="bridge_coin_stats">
          <div className="bridge_coin_stat">
            <div className="bridge_coin_details">
              <div className="bridge_coin_title">
                <h5>TO</h5>
                {transfer.type !== 'withdraw' ? zkSyncLayer2Header : ethLayer1Header}
              </div>
            </div>
          </div>
          <div className="bridge_coin_stat">
            <h5>Available balance</h5>
            <span>
              {altBalances[swapDetails.currency] && altBalances[swapDetails.currency].valueReadable}
                {` ${swapDetails.currency}`}
            </span>
          </div>
        </div>

        <div className="bridge_transfer_fee">
          Bridge Tax: 0%
          {' '}(0 {swapDetails.currency})
        </div>
        <div className="bridge_button">
          {!user.id && <Button
            className="bg_btn"
            text="CONNECT WALLET"
            img={darkPlugHead}
            onClick={() => api.signIn(network)}
          />}
          {user.id && !hasAllowance && <Button
            loading={isApproving}
            className={cx("bg_btn", { zig_disabled: formErr.length > 0 || swapDetails.amount.length === 0, })}
            text="APPROVE"
            style={{ marginBottom: 10 }}
            onClick={approveSpend}
          />}
          {user.id && hasError && <Button
            className="bg_btn zig_btn_disabled bg_err"
            text={formErr}
            icon={<BiError />}
          />}
          {user.id && !hasError && <Button
            loading={loading}
            className={cx("bg_btn", { zig_disabled: !hasAllowance || swapDetails.amount.length === 0 })}
            text="TRANSFER"
            icon={<MdSwapCalls />}
            onClick={doTransfer}
          />}
        </div>
      </div>
    </div>
  )
}

export default Bridge
