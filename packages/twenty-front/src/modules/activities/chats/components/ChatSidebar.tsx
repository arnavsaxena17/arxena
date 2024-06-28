import React from "react";
import * as frontChatTypes from "../types/front-chat-types";
import ChatTile from "./ChatTile";
import styled from "@emotion/styled";
import SearchBox from "./SearchBox";

const StyledSidebarContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 15vw;
  height: 100%;
  overflow-y: auto;
`;

export default function (props: {
  individuals: frontChatTypes.PersonEdge[];
  selectedIndividual: string;
  setSelectedIndividual: (value: React.SetStateAction<string>) => void;
}) {
  return (
    <div>
      <StyledSidebarContainer>
        <SearchBox placeholder="Hello"/>
        {props.individuals?.map((individual) => {
          return (
            <ChatTile
              individual={individual}
              setSelectedIndividual={props.setSelectedIndividual}
              selectedIndividual={props.selectedIndividual}
            />
          );
        })}
      </StyledSidebarContainer>
    </div>
  );
}
