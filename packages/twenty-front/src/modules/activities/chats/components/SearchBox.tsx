import React from "react";
import styled from "@emotion/styled";

const SearchBoxContainer = styled.div`
  display: flex;
  align-items: center;
  border-bottom: 1px solid #ccc;
  padding: 1rem 0.5rem;
  width: auto;
  max-width: 400px;
`;

// Define the props type
interface SearchBoxProps {
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}



const SearchIcon = styled.span`
  margin-right: 8px;
  color: #888;
`;

const SearchInput = styled.input`
  border: none;
  outline: none;
  width: 100%;
`;

const SearchBox: React.FC<SearchBoxProps> = ({ placeholder, value, onChange }) => {
  return (
    <SearchBoxContainer>
      <SearchIcon>🔍</SearchIcon>
      <SearchInput
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </SearchBoxContainer>
  );
};

export default SearchBox;
