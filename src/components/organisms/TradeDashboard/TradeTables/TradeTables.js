import React from "react";
import styled from "@xstyled/styled-components";
import OrdersTable from "./OrdersTable/OrdersTable";

const StyledTradeTables = styled.section`
  display: flex;
  grid-area: tables;
  background-color: ${({theme}) => theme.colors.backgroundMediumEmphasis};
`;

export default function TradeTables(props) {
  return (
    <StyledTradeTables>
      <OrdersTable
        userFills={props.userFills}
        userOrders={props.userOrders}
        user={props.user}
        wallet={props.wallet}
      />
    </StyledTradeTables>
  );
}
