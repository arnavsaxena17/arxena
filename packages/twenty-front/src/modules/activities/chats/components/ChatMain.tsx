import React, { useEffect, useRef, useState } from "react";
import { useChats } from "../hooks/useChats";
import axios from "axios";
import { useFindManyPeople } from "../hooks/useFindManyPeople";

import * as frontChatTypes from "../types/front-chat-types";
import ChatWindow from "./ChatWindow";

export default function ChatMain() {
  // const { loading, error, data } = useQuery(GET_DOGS);
  // if (error) return <div>Error</div>;
  // if (loading) return <div>Fetching</div>;
  const [inputMessage, setInputMessage] = useState("");
  // const [chats, setChats] = useState([]);
  const [selectedIndividual, setSelectedIndividual] = useState<string>("");
  const [individuals, setIndividuals] = useState<frontChatTypes.PersonEdge[]>(
    []
  );
  const inputRef = useRef(null);
  const [people, setPeople] = useState([]);

  const handleSubmit = () => {
    console.log("submit");
    // console.log(inputRef?.current?.value);
  };
  const variable = useChats();
  const variable2 = useFindManyPeople();
  console.log(variable);
  console.log(variable2);

  useEffect(() => {
    async function fetchData() {
      const response = await axios.get(
        "http://localhost:3000/arx-chat/get-candidates-and-chats"
      );
      console.log(response?.data?.people?.edges);
      setPeople(response?.data?.people?.edges);
      setIndividuals(
        response?.data?.people?.edges.filter(
          (person: frontChatTypes.PersonEdge) =>
            person?.node?.candidates?.edges?.length > 0
        )
      );
      console.log(
        response?.data?.people?.edges.filter(
          (person: frontChatTypes.PersonEdge) =>
            person?.node?.candidates?.edges?.length > 0
        )
      );
    }

    fetchData();

    const interval = setInterval(fetchData, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    debugger;
    console.log("selectedindividuals", selectedIndividual);
  }, [selectedIndividual]);

  return (
    <>
      <div>
        <h1>Chat Main</h1>
        <div>
          <p>Chat Main</p>

          <div style={{ display: "flex" }}>
            <div style={{ margin: "5em" }}>
              {individuals?.map((individual) => {
                //@ts-ignore
                return (
                  <div
                    onClick={() => {
                      setSelectedIndividual(individual?.node?.id);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <p>
                      {individual?.node?.name?.firstName}{" "}
                      {individual?.node?.name?.lastName}{" "}
                      {individual?.node?.phone}
                    </p>
                  </div>
                );
              })}
            </div>
            <div>
              {/* {variable?.records?.map((record) => {
                return (
                  <div key={record.id}>
                    <p>{record.message}</p>
                  </div>
                );
              })} */}
              {/* {chats} */}
              {/* {individuals
                ?.filter((individual) => {
                  return individual?.node?.id === selectedIndividual;
                })[0]
                ?.node?.candidates?.edges[0]?.node?.whatsappMessages?.edges?.map(
                  (message) => {
                    return <p>{message?.node?.message}</p>;
                  }
                )
              // ?.node?.whatsappMessages?.edges?.map((message) => {
              //   return <p>{message}</p>;
              // })
              }
              <input type="text" ref={inputRef} />
              <button onClick={handleSubmit}>Submit</button> */}
              <ChatWindow
                selectedIndividual={selectedIndividual}
                individuals={individuals}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// import React, { useState, useEffect } from "react";
// import axios from "axios";
// import { useChats } from "../hooks/useChats";

// interface Individual {
//   id: number;
//   name: string;
// }

// interface Chat {
//   sender: string;
//   message: string;
// }

// interface ChatWindowProps {
//   individuals: Individual[];
// }

// const ChatWindow: React.FC<ChatWindowProps> = ({ individuals }) => {
//   const [selectedIndividual, setSelectedIndividual] =
//     useState<Individual | null>(null);
//   const [chats, setChats] = useState<Chat[]>([]);
//   const [newMessage, setNewMessage] = useState<string>("");

//   useEffect(() => {
//     const fetchChats = async () => {
//       if (selectedIndividual) {
//         try {
//           const chatMessageObject = useChats();
//           setChats(chatMessageObject?.records);
//         } catch (error) {
//           console.error("Error fetching chats:", error);
//         }
//       }
//     };

//     fetchChats();
//     const interval = setInterval(fetchChats, 5000);

//     return () => clearInterval(interval);
//   }, [selectedIndividual]);

//   const handleSendMessage = async () => {
//     if (newMessage.trim()) {
//       try {
//         await axios.post("/api/sendMessage", {
//           individualId: selectedIndividual?.id,
//           message: newMessage,
//         });
//         setNewMessage("");
//         // Fetch the updated chats immediately after sending a message
//         const response = await axios.get<Chat[]>(
//           `/api/chats?individualId=${selectedIndividual?.id}`
//         );
//         setChats(response.data);
//       } catch (error) {
//         console.error("Error sending message:", error);
//       }
//     }
//   };

//   return (
//     <div style={{ display: "flex", height: "100vh" }}>
//       <div
//         style={{
//           width: "200px",
//           borderRight: "1px solid #ccc",
//           overflowY: "auto",
//         }}
//       >
//         {individuals.map((individual) => (
//           <div
//             key={individual.id}
//             onClick={() => setSelectedIndividual(individual)}
//             style={{
//               padding: "10px",
//               cursor: "pointer",
//               backgroundColor:
//                 selectedIndividual && selectedIndividual.id === individual.id
//                   ? "#f0f0f0"
//                   : "#fff",
//             }}
//           >
//             {individual.name}
//           </div>
//         ))}
//       </div>
//       <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
//         <div
//           style={{
//             flex: 1,
//             padding: "10px",
//             overflowY: "auto",
//             borderBottom: "1px solid #ccc",
//           }}
//         >
//           {selectedIndividual ? (
//             chats.map((chat, index) => (
//               <div key={index} style={{ marginBottom: "10px" }}>
//                 <strong>{chat.sender}:</strong> <span>{chat.message}</span>
//               </div>
//             ))
//           ) : (
//             <div>Select an individual to see the chat</div>
//           )}
//         </div>
//         {selectedIndividual && (
//           <div
//             style={{
//               display: "flex",
//               padding: "10px",
//               borderTop: "1px solid #ccc",
//             }}
//           >
//             <input
//               type="text"
//               value={newMessage}
//               onChange={(e) => setNewMessage(e.target.value)}
//               style={{ flex: 1, marginRight: "10px" }}
//             />
//             <button onClick={handleSendMessage}>Send</button>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default ChatWindow;
