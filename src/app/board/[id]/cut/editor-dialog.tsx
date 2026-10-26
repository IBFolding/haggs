"use client";
import{useEffect,useRef,type ReactNode}from"react";
export function EditorDialog({label,onClose,children}:{label:string;onClose:()=>void;children:ReactNode}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const d=ref.current;d?.showModal();return()=>d?.close();},[]);return <dialog ref={ref} className="ed-dialog" aria-label={label} onCancel={e=>{e.preventDefault();onClose();}}>{children}</dialog>;}
