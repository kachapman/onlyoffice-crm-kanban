<%@ Page Language="C#" AutoEventWireup="true" CodeBehind="Default.aspx.cs" MasterPageFile="Masters/BasicTemplate.Master" Inherits="ASC.Web.OpportunityBoard.DefaultPage" %>
<%@ Import Namespace="ASC.Web.OpportunityBoard.Resources" %>
<%@ MasterType TypeName="ASC.Web.OpportunityBoard.Masters.BasicTemplate" %>

<asp:Content ID="BoardContent" ContentPlaceHolderID="BTPageContent" runat="server">
    <div id="ob-kanban-root" class="ob-kanban">
        <header class="hero">
            <div class="hero-inner">
                <div class="hero-copy">
                    <p class="eyebrow"><%= OpportunityBoardResource.ProductName %></p>
                    <h1 class="hero-title"><%= OpportunityBoardResource.BoardTitle %></h1>
                    <p class="hero-desc"><%= OpportunityBoardResource.BoardDescription %></p>
                </div>
                <div class="hero-actions">
                    <button type="button" id="refresh-btn" class="btn btn-secondary"><%= OpportunityBoardResource.Refresh %></button>
                </div>
            </div>
        </header>

        <section class="toolbar">
            <div class="toolbar-row">
                <div class="field">
                    <label for="search"><%= OpportunityBoardResource.SearchLabel %></label>
                    <input type="search" id="search" />
                </div>
                <div class="field">
                    <label for="group-by"><%= OpportunityBoardResource.GroupBy %></label>
                    <select id="group-by">
                        <option value="stage"><%= OpportunityBoardResource.GroupStage %></option>
                        <option value="responsible"><%= OpportunityBoardResource.GroupResponsible %></option>
                        <option value="stageType"><%= OpportunityBoardResource.GroupOutcome %></option>
                    </select>
                </div>
                <div class="field">
                    <label for="stage-type"><%= OpportunityBoardResource.StageType %></label>
                    <select id="stage-type">
                        <option value=""><%= OpportunityBoardResource.All %></option>
                        <option value="0"><%= OpportunityBoardResource.OpenOnly %></option>
                        <option value="1"><%= OpportunityBoardResource.ClosedWon %></option>
                        <option value="2"><%= OpportunityBoardResource.ClosedLost %></option>
                    </select>
                </div>
                <div class="field">
                    <label for="stage-filter"><%= OpportunityBoardResource.Stage %></label>
                    <select id="stage-filter" data-all-label="<%= OpportunityBoardResource.AllStages %>">
                        <option value=""><%= OpportunityBoardResource.AllStages %></option>
                    </select>
                </div>
                <div class="field">
                    <label for="tags"><%= OpportunityBoardResource.Tags %></label>
                    <input type="text" id="tags" placeholder="<%= OpportunityBoardResource.TagsHint %>" />
                </div>
                <div class="field field-narrow">
                    <label for="contact-id"><%= OpportunityBoardResource.ContactId %></label>
                    <input type="number" id="contact-id" min="0" />
                </div>
                <div class="field">
                    <label for="from-date"><%= OpportunityBoardResource.FromDate %></label>
                    <input type="date" id="from-date" />
                </div>
                <div class="field">
                    <label for="to-date"><%= OpportunityBoardResource.ToDate %></label>
                    <input type="date" id="to-date" />
                </div>
            </div>
            <div class="toolbar-meta">
                <span id="status-text"><%= OpportunityBoardResource.Loading %></span>
            </div>
        </section>

        <main id="board" class="board" aria-live="polite"></main>
        <div id="toast" class="toast hidden" role="status"></div>
    </div>
</asp:Content>