"use client";
import { useState, useEffect } from "react";

export const useProofStorage = () => {
  const [proofs, setProofs] = useState([]);
  const [username, setUsername] = useState("");
  const [statusUrl, setStatusUrl] = useState("");

  // Load proofs from localStorage on component mount
  useEffect(() => {
    const storedStatusUrl = localStorage.getItem("statusUrl");
    if (storedStatusUrl) {
      setStatusUrl(storedStatusUrl);
      fetchProofs(storedStatusUrl);
    }
  }, []);

  const fetchProofs = async (url) => {
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.session?.proofs) {
        setProofs(data.session.proofs);
        if (data.session.proofs[0]?.claimData?.context) {
          try {
            const context = JSON.parse(data.session.proofs[0].claimData.context);
            setUsername(context.extractedParameters?.username || "");
          } catch (error) {
            console.error("Error parsing claimData context:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching proofs:", error);
    }
  };

  const saveProofs = (newProofs, newStatusUrl) => {
    if (newStatusUrl) {
      localStorage.setItem("statusUrl", newStatusUrl);
      setStatusUrl(newStatusUrl);
    }
    setProofs(newProofs);
  };

  const clearProofs = () => {
    localStorage.removeItem("statusUrl");
    setProofs([]);
    setUsername("");
    setStatusUrl("");
  };

  return {
    proofs,
    username,
    statusUrl,
    saveProofs,
    clearProofs,
    fetchProofs
  };
}; 