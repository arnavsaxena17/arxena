import React, { useRef } from "react";
import * as frontChatTypes from "../types/front-chat-types";
import axios from "axios";

export default function ChatWindow(props: {
  selectedIndividual: string;
  individuals: frontChatTypes.PersonEdge[];
}) {
  const inputRef = useRef(null);

  let currentIndividual = props?.individuals?.filter((individual) => {
    return individual?.node?.id === props.selectedIndividual;
  })[0];

  let listOfMessages =
    currentIndividual?.node?.candidates?.edges[0]?.node?.whatsappMessages
      ?.edges;

  listOfMessages?.sort(
    (a, b) =>
      new Date(a?.node?.createdAt).getTime() -
      new Date(b?.node?.createdAt).getTime()
  );

  const sendMessage = async (messageText: string) => {
    console.log("send message");
    const response = await axios.post(
      "http://localhost:3000/arx-chat/send-chat",
      {
        messageToSend: messageText,
        phoneNumberTo: currentIndividual?.node?.phone,
      }
    );
  };
  const handleSubmit = () => {
    console.log("submit");
    console.log(inputRef?.current?.value);
    sendMessage(inputRef?.current?.value);
    inputRef.current.value = ""; // Clear the input field
  };
  return (
    <>
      {listOfMessages?.map((message) => {
        return <p>{message?.node?.message}</p>;
      })
      // ?.node?.whatsappMessages?.edges?.map((message) => {
      //   return <p>{message}</p>;
      // })
      }
      <input type="text" ref={inputRef} placeholder="Type your message" />
      <button onClick={handleSubmit}>Submit</button>
    </>
  );
}
