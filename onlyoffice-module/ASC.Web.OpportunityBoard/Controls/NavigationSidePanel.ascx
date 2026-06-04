<%@ Import Namespace="ASC.Web.OpportunityBoard.Resources" %>
<%@ Control Language="C#" AutoEventWireup="true" CodeBehind="NavigationSidePanel.ascx.cs" Inherits="ASC.Web.OpportunityBoard.Controls.NavigationSidePanel" %>

<div class="page-menu">
    <ul class="menu-list">
        <li class="menu-item none-sub-list<% if (CurrentPage == "default") { %> active<% } %>">
            <a class="menu-item-label outer-text text-overflow" href="Default.aspx" title="<%= OpportunityBoardResource.BoardTitle %>">
                <span class="menu-item-icon opportunityboard"></span>
                <span class="menu-item-label inner-text"><%= OpportunityBoardResource.BoardTitle %></span>
            </a>
        </li>
    </ul>
</div>