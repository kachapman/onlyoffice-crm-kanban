<%@ Import Namespace="ASC.Web.OpportunityBoard.Resources" %>
<%@ Control Language="C#" AutoEventWireup="true" CodeBehind="ButtonsSidePanel.ascx.cs" Inherits="ASC.Web.OpportunityBoard.Controls.ButtonsSidePanel" %>

<div class="page-menu">
    <ul class="menu-actions">
        <li class="menu-main-button without-separator middle" title="<%= OpportunityBoardResource.BoardTitle %>">
            <a class="main-button-text" href="../CRM/Deals.aspx"><%= OpportunityBoardResource.OpenCrm %></a>
        </li>
    </ul>
</div>