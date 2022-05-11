import React, { useMemo } from "react";
import { useSelector } from "react-redux";
import { useParams, Link } from "react-router-dom";
import { Box } from "@material-ui/core";
import styled from "@xstyled/styled-components";
import { networkSelector } from "lib/store/features/api/apiSlice";
import { BridgeTemplate } from "components";
import cx from "classnames";
import api from "lib/api";
import Bridge from "./Bridge/Bridge";
import BridgeReceipts from "./BridgeReceipts/BridgeReceipts";
import BridgeIncompatible from "./Bridge/BridgeIncompatible";
import "./BridgePage.style.css";

const BrideHeadTabs = styled.div`
  display: inline-flex;
  margin: 20px 0;
  flex-direction: row;
  border-bottom: 1px solid ${({ theme }) => theme.colors.foreground400};

  > a {
    display: block;
    position: relative;
    margin-left: -1px;
    padding-bottom: 1rem;
    text-transform: uppercase;
    text-decoration: none;
    text-shadow: 0 0 4px rgba(255, 255, 255, 0.3);
    font-weight: 500;
    font-size: 13px;
    background: transparent;
    color: foregroundHighEmphasis;
    transition: all 0.15s ease-in-out;

    &:first-child {
      margin-right: 18px;
      
      &::after {
        transform-origin: right;
      }
    }

    &:last-child::after {
      transform-origin: left;
    }

    &:hover {
      color: #000;
    }

    &:active, &.bridge_head_tab_active {
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4);
      color: ${(p) => p.theme.colors.foregroundHighEmphasis};
      
      &::after {
        transform: scale(1, 1);
      }
    }

    &::after {
      content: ' ';
      display: block;
      position: absolute;
      bottom: 0;
      width: 100%;
      height: 3px;
      background: linear-gradient(93.46deg, #2AABEE 16.94%, #0CCFCF 97.24%);
      transform: scale(0, 1);
      transition: transform .3s;
    }
  }
`;

const BridgeSection = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 48px);
  padding: 2rem 0;
  background-color: ${(p) => p.theme.colors.bridgeBackground};
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
  flex-direction: column;
  justify-content: center;

  a:hover {
    color: #09aaf5;
  }

  h3 {
    color: ${(p) => p.theme.colors.foregroundHighEmphasis}
  }
`;

export default function BridgePage() {
  const network = useSelector(networkSelector);
  const isBridgeCompatible = useMemo(
    () => network && api.isImplemented("depositL2"),
    [network]
  );
  const tab = useParams().tab || "bridge";

  return (
    <BridgeTemplate>
      <BridgeSection>
        <div className="bridge_container">
          <Box component="h3">ZigZag Bridge</Box>
          <BrideHeadTabs>
            <Link
              className={cx({ bridge_head_tab_active: tab === "bridge" })}
              to="/bridge"
            >
              Bridge
            </Link>
            <Link
              className={cx({ bridge_head_tab_active: tab === "receipts" })}
              to="/bridge/receipts"
            >
              Transfer History
            </Link>
          </BrideHeadTabs>
        </div>
        <div className="bridge_container" style={{ flex: "1 1 auto" }}>
          {isBridgeCompatible ? (
            tab === "bridge" ? (
              <Bridge />
            ) : (
              <BridgeReceipts />
            )
          ) : (
            <BridgeIncompatible />
          )}
        </div>
      </BridgeSection>
    </BridgeTemplate>
  );
}
